import { describe, expect, it } from "vitest";
import { coreEntry, parserEntry, renderEntry } from "./index";

describe("metweave umbrella", () => {
  it("re-exports core, parser and render through one entry", () => {
    expect(coreEntry.name).toBe("@metweave/core");
    expect(parserEntry.name).toBe("@metweave/parser");
    expect(renderEntry.name).toBe("@metweave/render");
  });
});
