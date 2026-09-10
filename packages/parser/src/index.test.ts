import { describe, expect, it } from "vitest";
import { parserEntry } from "./index";

describe("@metweave/parser", () => {
  it("exports the pipeline stage marker", () => {
    expect(parserEntry.stage).toBe("parse");
  });
});
