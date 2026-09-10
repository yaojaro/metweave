import { describe, expect, it } from "vitest";
import { coreEntry } from "./index";

describe("@metweave/core", () => {
  it("exports the pipeline stage marker", () => {
    expect(coreEntry.stage).toBe("standardize");
  });
});
