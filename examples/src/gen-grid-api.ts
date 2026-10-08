/**
 * 「拉最新」dev 中间件（仅 dev server 装配，构建产物不含——本文件只被 vite.config.ts
 * 引用，页面代码永不 import）。浏览器只与本中间件和静态 .mwgrid 交互，NOMADS 取数与
 * GRIB 解码全在 Node 侧（「GRIB 不进浏览器」红线维持）。
 *
 * GET /api/gen-grid?element=<short-name>&fhour=<auto|0-120>
 *   → spawn `node scripts/gen-grid.mjs --element <name> --fhour <fhour>`（cycle 自动
 *     回退/重试/解码/落盘 examples/data/grid/，全在 CLI 内；fhour 缺省 0）→ JSON 应答：
 *   200 {ok:true,  element, fhour, output}     成功（fhour＝CLI 回报的实际时效档——auto
 *                                              定档后面板按它构造产物文件名直载；output
 *                                              为进度尾部，诊断用）
 *   400 {ok:false, error}                       element 缺失（兼作中间件存在性探测）或非法
 *   405 {ok:false, error}                       非 GET
 *   409 {ok:false, error}                       上一拉取仍在进行中（并发防抖）
 *   500 {ok:false, error}                       grid dist 未构建（先构建再拉）或 gen-grid 退出非 0
 *   504 {ok:false, error}                       5 分钟兜底超时（子进程被杀）
 *
 * 静态部署（如 GitHub Pages）无本中间件：探测端点返回 404，前端按钮自隐藏——与
 * iwxxm 预取「无代理静默降级」同纪律。runner/distReady 以依赖注入进工厂：vite.config
 * 接真实现（spawn/existsSync），测试注入假件（零进程、零网络）。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

interface GenGridRunResult {
  /** 子进程退出码（0 = 成功） */
  readonly code: number;
  /** stdout+stderr 合流尾部（截 2000 字，诊断信息） */
  readonly output: string;
}

/** 取数执行器：真实件为 spawn 封装；测试注入假件。AbortSignal 用于兜底超时杀进程。
 * fhour 为已验证的时效参数串（"auto" 或 "0"–"120"），真实件原样透传 CLI --fhour。 */
export type GenGridRunner = (
  element: string,
  fhour: string,
  signal: AbortSignal,
) => Promise<GenGridRunResult>;

/** gen-grid.mjs 经 dist 直引消费包产物——运行前须已构建（缺失给出可行动的提示）。 */
export type DistReadyChecker = () => boolean;

const tail = (text: string, max = 2000): string =>
  text.length <= max ? text : `…${text.slice(-max)}`;

/** 真实 runner：spawn node scripts/gen-grid.mjs --element <name> --fhour <fhour>
 * （stdio 合流收集；abort 即杀）。CLI 的「FHOUR HHH」回报行由此进 output、由中间件解析。 */
export function spawnGenGrid(scriptPath: string, cwd: string): GenGridRunner {
  return (element, fhour, signal) =>
    new Promise<GenGridRunResult>((resolve) => {
      const child = spawn(process.execPath, [scriptPath, "--element", element, "--fhour", fhour], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      const collect = (chunk: Buffer): void => {
        output += chunk.toString("utf8");
        if (output.length > 20_000) output = tail(output, 20_000); // 防超长输出占内存
      };
      child.stdout?.on("data", collect);
      child.stderr?.on("data", collect);
      const onAbort = (): void => {
        child.kill("SIGKILL");
      };
      signal.addEventListener("abort", onAbort, { once: true });
      child.on("error", (err) => {
        signal.removeEventListener("abort", onAbort);
        resolve({ code: -1, output: `spawn 失败：${err.message}` });
      });
      child.on("close", (code) => {
        signal.removeEventListener("abort", onAbort);
        resolve({ code: code ?? -1, output });
      });
    });
}

/** 仓库根下 grid 包 dist 产物检查（gen-grid dist 直引 convert.js）。 */
export function gridDistReady(rootDir: string): DistReadyChecker {
  return () => existsSync(`${rootDir}/packages/grid/dist/convert.js`);
}

const sendJson = (res: ServerResponse, status: number, body: Record<string, unknown>): void => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

/** element 合法形态：小写字母数字（gen:grid CLI 的要素键集；语义校验由 CLI 自身负责）。 */
const ELEMENT_RE = /^[a-z0-9]{1,16}$/;

/** fhour 合法形态："auto" 或 0–120 整数（GFS 0.25° 逐小时区）。 */
const FHOUR_RE = /^(auto|0|[1-9][0-9]{0,2})$/;
const fhourOf = (raw: string): { ok: true; value: string } | { ok: false; error: string } => {
  if (!FHOUR_RE.test(raw))
    return { ok: false, error: `fhour 参数非法："${raw}"（auto 或 0–120 整数）` };
  if (raw !== "auto" && Number(raw) > 120)
    return { ok: false, error: `fhour 超出逐小时区："${raw}"（0–120）` };
  return { ok: true, value: raw };
};

/** 从 CLI 输出解析实际时效档（「FHOUR HHH」回报行——auto 定档后面板按它构造文件名）。 */
const parseFhourFromOutput = (output: string): number | undefined => {
  const m = /FHOUR (\d{3})/.exec(output);
  return m === null ? undefined : Number(m[1]);
};

/**
 * 中间件工厂。并发防抖＝模块内单一「进行中」槽（全服同一时刻至多一个拉取；重复触发
 * 409 而非排队——demo 是单人本地工具，排队只会堆超时）。超时＝AbortController 兜底
 * （缺省 5 分钟：cycle 探测重试 + 下载 + 解码的最坏量级），到点杀子进程、放行下一次。
 */
export function createGenGridMiddleware(deps: {
  runner: GenGridRunner;
  distReady: DistReadyChecker;
  timeoutMs?: number;
}): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void {
  const timeoutMs = deps.timeoutMs ?? 5 * 60_000;
  let running = false;
  return (req, res, next) => {
    if (req.url === undefined) {
      next();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { ok: false, error: "仅支持 GET" });
      return;
    }
    const element = url.searchParams.get("element");
    if (element === null || element === "") {
      // 兼作存在性探测端点：中间件在位＝可分辨的 400（静态部署为 404，前端据此隐藏按钮）
      sendJson(res, 400, {
        ok: false,
        error: "element 参数缺失（用法 GET /api/gen-grid?element=tmp&fhour=auto）",
      });
      return;
    }
    if (!ELEMENT_RE.test(element)) {
      sendJson(res, 400, { ok: false, error: `element 参数非法："${element}"（小写字母数字）` });
      return;
    }
    const fhourRaw = url.searchParams.get("fhour") ?? "0";
    const fhourChecked = fhourOf(fhourRaw);
    if (!fhourChecked.ok) {
      sendJson(res, 400, { ok: false, error: fhourChecked.error });
      return;
    }
    const fhour = fhourChecked.value;
    if (!deps.distReady()) {
      sendJson(res, 500, {
        ok: false,
        error: "@metweave/grid 未构建——先在仓库根执行 pnpm --filter @metweave/grid build",
      });
      return;
    }
    if (running) {
      sendJson(res, 409, { ok: false, error: "上一次拉取仍在进行中（稍候再试）" });
      return;
    }
    running = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    void (async () => {
      try {
        const { code, output } = await deps.runner(element, fhour, controller.signal);
        if (controller.signal.aborted) {
          sendJson(res, 504, {
            ok: false,
            error: `拉取超时（${Math.round(timeoutMs / 60_000)} 分钟兜底），已中止`,
          });
        } else if (code === 0) {
          sendJson(res, 200, {
            ok: true,
            element,
            fhour: parseFhourFromOutput(output),
            output: tail(output),
          });
        } else {
          sendJson(res, 500, {
            ok: false,
            element,
            error: tail(output) || `gen-grid 退出码 ${code}`,
          });
        }
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      } finally {
        clearTimeout(timer);
        running = false;
      }
    })();
  };
}
