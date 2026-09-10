import { describe, expect, it } from "vitest";
import { renderEntry } from "./index";

describe("@metweave/render", () => {
  it("exports the pipeline stage marker", () => {
    expect(renderEntry.stage).toBe("render");
  });
});
