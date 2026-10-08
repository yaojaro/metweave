/**
 * 「拉最新」dev 中间件测试（零进程、零网络：runner/distReady 注入假件，req/res 以
 * 最小双件驱动）：探测端点、参数校验、dist 前置、并发防抖、兜底超时、成败应答形态。
 * 真实 spawn 路径不在此重放——gen-grid CLI 本身的行为由其冒烟使用面与取数纪律守。
 */
import { describe, expect, it, vi } from "vitest";
import { createGenGridMiddleware, type GenGridRunner } from "./gen-grid-api";
import type { IncomingMessage, ServerResponse } from "node:http";

interface Captured {
  status: number;
  body: Record<string, unknown>;
}

const fakeRes = (capture: (c: Captured) => void): ServerResponse => {
  const res = {
    statusCode: 0,
    setHeader: () => undefined,
    end: (body: string) =>
      capture({ status: res.statusCode, body: JSON.parse(body) as Record<string, unknown> }),
  };
  return res as unknown as ServerResponse;
};

const call = (
  mw: ReturnType<typeof createGenGridMiddleware>,
  url: string | undefined,
  method = "GET",
): Promise<Captured> =>
  new Promise((resolve) => {
    const req = { method, url } as IncomingMessage;
    // next() 被调＝非本端点流量直放行；这里用 404 形态捕获以便断言「未接手」
    const res = fakeRes(resolve);
    mw(req, res, () => resolve({ status: 404, body: { passthrough: true } }));
  });

const okRunner: GenGridRunner = async (element) => ({
  code: 0,
  output: `cycle=2026100606 要素 1 个\n[1/1] tmp   TMP/2m          1.2s → tmp_cn.mwgrid 176KB\n全部完成：1/1 (${element})`,
});

/** CLI 退出非 0 形态（未知要素/取数失败时的 gen-grid 输出）——模块级常量（不捕获外层作用域） */
const exitFailureRunner: GenGridRunner = async () => ({
  code: 2,
  output: "未知要素：xxx（可用：tmp …）",
});

/** runner 抛错形态（spawn 失败等）——同上 */
const throwingRunner: GenGridRunner = async () => {
  throw new Error("spawn 失败：ENOENT");
};

const distReadyTrue = () => true;

/** 无捕获假件（模块级——consistent-function-scoping 纪律）：恒成功带 FHOUR 回报。 */
const okFhourRunner: GenGridRunner = async () => ({ code: 0, output: "FHOUR 000" });
/** 无捕获假件：成功但无 FHOUR 行（旧版 CLI 兼容形态）。 */
const okNoFhourRunner: GenGridRunner = async () => ({ code: 0, output: "全部完成：1/1" });

describe("fhour 参数（预报时效透传）", () => {
  it("非法值 400：非数字、超 120、负数形态", async () => {
    const runner: GenGridRunner = okFhourRunner;
    const mw = createGenGridMiddleware({ runner, distReady: distReadyTrue });
    expect((await call(mw, "/?element=tmp&fhour=6x")).status).toBe(400);
    expect((await call(mw, "/?element=tmp&fhour=999")).status).toBe(400);
    expect((await call(mw, "/?element=tmp&fhour=-6")).status).toBe(400);
    expect((await call(mw, "/?element=tmp&fhour=")).status).toBe(400);
  });

  it("合法值透传 runner（auto/显式档/缺省 0），200 应答回带 CLI 报告的实际档", async () => {
    const seen: string[] = [];
    const runner: GenGridRunner = async (el, fhour) => {
      seen.push(`${el}:${fhour}`);
      return { code: 0, output: "cycle=2026100706\nFHOUR 006\n全部完成：1/1" };
    };
    const mw = createGenGridMiddleware({ runner, distReady: distReadyTrue });
    const ok = await call(mw, "/?element=tmp&fhour=auto");
    expect(ok.status).toBe(200);
    expect(ok.body.fhour).toBe(6); // CLI「FHOUR HHH」回报行 → 面板按它构造产物名直载
    expect(seen).toEqual(["tmp:auto"]);
    const dflt = await call(mw, "/?element=tmp");
    expect(dflt.status).toBe(200);
    expect(seen.at(-1)).toBe("tmp:0"); // 缺省 fhour＝0（批产兼容）
    const explicit = await call(mw, "/?element=gh&fhour=72");
    expect(explicit.status).toBe(200);
    expect(seen.at(-1)).toBe("gh:72");
  });

  it("输出无 FHOUR 行：fhour 字段缺席（旧版 CLI 兼容——面板回落请求档）", async () => {
    const runner: GenGridRunner = okNoFhourRunner;
    const mw = createGenGridMiddleware({ runner, distReady: distReadyTrue });
    const ok = await call(mw, "/?element=tmp&fhour=12");
    expect(ok.status).toBe(200);
    expect(ok.body.fhour).toBeUndefined();
  });
});

describe("createGenGridMiddleware", () => {
  it("缺 element → 400（探测端点：静态部署 404 与之可分辨）", async () => {
    const mw = createGenGridMiddleware({ runner: okRunner, distReady: distReadyTrue });
    const r = await call(mw, "");
    expect(r.status).toBe(400);
    expect(r.body.ok).toBe(false);
    expect(r.body.error).toContain("element 参数缺失");
  });

  it("req.url 缺失 → 直放行 next()", async () => {
    const mw = createGenGridMiddleware({ runner: okRunner, distReady: distReadyTrue });
    const r = await call(mw, undefined);
    expect(r.body).toEqual({ passthrough: true });
  });

  it("非 GET → 405", async () => {
    const mw = createGenGridMiddleware({ runner: okRunner, distReady: distReadyTrue });
    const r = await call(mw, "/?element=tmp", "POST");
    expect(r.status).toBe(405);
  });

  it("element 非法（大写/注入形态）→ 400 且不触 runner", async () => {
    const runner = vi.fn(okRunner);
    const mw = createGenGridMiddleware({ runner, distReady: distReadyTrue });
    expect((await call(mw, "/?element=TMP")).status).toBe(400);
    expect((await call(mw, "/?element=tmp%3B%20rm%20-rf")).status).toBe(400);
    expect(runner).not.toHaveBeenCalled();
  });

  it("grid dist 未构建 → 500 带可行动提示", async () => {
    const mw = createGenGridMiddleware({ runner: okRunner, distReady: () => false });
    const r = await call(mw, "/?element=tmp");
    expect(r.status).toBe(500);
    expect(r.body.error).toContain("pnpm --filter @metweave/grid build");
  });

  it("成功 → 200 {ok:true, element, output 尾部}", async () => {
    const mw = createGenGridMiddleware({ runner: okRunner, distReady: distReadyTrue });
    const r = await call(mw, "/?element=tmp");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.element).toBe("tmp");
    expect(r.body.output).toContain("全部完成");
  });

  it("CLI 退出非 0（未知要素/取数失败）→ 500 {ok:false, error=输出尾部}", async () => {
    const mw = createGenGridMiddleware({ runner: exitFailureRunner, distReady: distReadyTrue });
    const r = await call(mw, "/?element=xxx");
    expect(r.status).toBe(500);
    expect(r.body.ok).toBe(false);
    expect(r.body.error).toContain("未知要素");
  });

  it("runner 抛错 → 500（不悬挂）", async () => {
    const mw = createGenGridMiddleware({ runner: throwingRunner, distReady: distReadyTrue });
    const r = await call(mw, "/?element=tmp");
    expect(r.status).toBe(500);
    expect(r.body.error).toContain("ENOENT");
  });

  it("并发防抖：进行中再触发 → 409；完结后槽位释放可再拉", async () => {
    let release: (() => void) | undefined;
    let calls = 0;
    const runner: GenGridRunner = () => {
      calls += 1;
      if (calls > 1) return Promise.resolve({ code: 0, output: "done" }); // 后续调用即刻成功
      return new Promise((resolve) => {
        release = () => resolve({ code: 0, output: "done" });
      });
    };
    const mw = createGenGridMiddleware({ runner, distReady: distReadyTrue });
    const first = call(mw, "/?element=tmp");
    await Promise.resolve(); // 等首请求真正进入 running 槽（微任务 flush）
    const second = await call(mw, "/?element=tmp");
    expect(second.status).toBe(409);
    expect(second.body.error).toContain("进行中");
    release?.();
    const done = await first;
    expect(done.status).toBe(200);
    const third = await call(mw, "/?element=tmp");
    expect(third.status).toBe(200); // 槽位已释放
  });

  it("兜底超时：到点中止 → 504，且槽位释放", async () => {
    let calls = 0;
    const runner: GenGridRunner = (_el, _fhour, signal) => {
      calls += 1;
      if (calls > 1) return Promise.resolve({ code: 0, output: "done" });
      return new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve({ code: -1, output: "killed" }), {
          once: true,
        });
      });
    };
    const mw = createGenGridMiddleware({ runner, distReady: distReadyTrue, timeoutMs: 25 });
    const first = call(mw, "/?element=tmp");
    const r = await first;
    expect(r.status).toBe(504);
    expect(r.body.error).toContain("超时");
    const next = await call(mw, "/?element=tmp");
    expect(next.status).toBe(200); // 槽位已随超时释放
  });
});
