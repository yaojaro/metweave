// 泄露检查的共享模式加载——机制公开，模式私有：
//   真实敏感词清单（身份、凭证邮箱、内部黑话）不进仓库，路径通过环境变量
//   METWEAVE_LEAK_PATTERNS 提供（私有工作区持有清单文件，仓库零路径泄漏）。
//   本模块是唯一加载入口（check-leaks.mjs 与 git 钩子共用），禁止在别处再复制一份模式解析。
//   行级豁免：在该行加 leak-ignore 并附理由。
import { pathToFileURL } from "node:url";

// 内置通用模式（公开安全）：占位内部标记 + 疑似硬编码密钥兜底
export const GENERIC_PATTERNS = [
  ["内部标记", /INTERNAL[ -]ONLY|DO[ -]NOT[ -](COMMIT|PUBLISH)/],
  [
    "疑似硬编码密钥（带引号）",
    /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9/_-]{20,}["']/i,
  ],
  // 裸赋值形态：.env / Vite define / 框架 env 注入都长这样（VITE_X_KEY=32位hex），
  // 上面那条要求带引号且限定 api_key|secret|token 三词，漏掉 *_KEY=<hex> 这一类
  //（2026-09-15 发布前审核实测：examples/.env.local 的 VITE_TIANDITU_KEY=<32hex> 两处都不匹配）。
  [
    "疑似硬编码密钥（裸赋值）",
    /(?:^|[^A-Za-z0-9_])(?:[A-Za-z0-9]+_)*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)\s*[:=]\s*["']?[A-Za-z0-9+/_-]{16,}["']?/,
  ],
];

/**
 * 加载私有敏感词清单：未设置环境变量时返回内置通用模式（降级由调用方按模式决定是否 fail-closed）；
 * 加载失败返回 failed=true（清单路径存在但不可读/不合法——按 fail-closed 处理，绝不静默弱化）。
 */
export async function loadLeakPatterns(envPath) {
  if (!envPath) return { patterns: null, source: "内置通用模式", failed: false };
  try {
    const mod = await import(pathToFileURL(envPath).href);
    return { patterns: mod.default, source: "私有模式清单", failed: false };
  } catch {
    return { patterns: null, source: "内置通用模式", failed: true };
  }
}
