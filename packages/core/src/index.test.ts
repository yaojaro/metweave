import { describe, expect, it } from "vitest";
import { unwrap, type Span } from "./index";
import { EN_MESSAGES } from "./errors";
import type { MetarParseErrorCode, MetarSourceErrorCode } from "./errors";

describe("@metweave/core IR", () => {
  it("unwrap：有值返回 value，缺测与组省略返回 undefined", () => {
    const span: Span = { start: 0, end: 7 };
    expect(unwrap({ kind: "value", value: 2500, span })).toBe(2500);
    expect(unwrap({ kind: "missing", span })).toBeUndefined();
    expect(unwrap(undefined)).toBeUndefined();
  });
});

describe("EN_MESSAGES 错误码英文文案（供消费方映射）", () => {
  const PARSE_CODES: readonly MetarParseErrorCode[] = [
    "invalid-input",
    "missing-station",
    "missing-time",
    "invalid-time",
    "missing-validity",
    "invalid-validity",
    "unsupported-mode",
    "strict-violation",
    "batch-parse-failed",
  ];
  const SOURCE_CODES: readonly MetarSourceErrorCode[] = [
    "http-error",
    "bad-schema",
    "empty-data",
    "timeout",
    "network",
  ];

  it("覆盖全部 parse 9 码 + source 5 码，且无多余键（code 只增不改——新增码必须补文案）", () => {
    const expected = [...PARSE_CODES, ...SOURCE_CODES];
    expect(Object.keys(EN_MESSAGES)).toHaveLength(expected.length);
    expect(new Set(Object.keys(EN_MESSAGES)), "键集与 13 码完全一致").toEqual(new Set(expected));
  });

  it("每条文案为非空英文（消费方可直接落 UI）", () => {
    for (const code of [...PARSE_CODES, ...SOURCE_CODES]) {
      const text = EN_MESSAGES[code];
      expect(text, `${code} 缺英文文案`).toBeTruthy();
      expect(text, `${code} 文案应为英文`).toMatch(/^[A-Z]/);
    }
  });
});
