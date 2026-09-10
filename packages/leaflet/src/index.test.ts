import { describe, expect, it } from "vitest";
import { leafletEntry } from "./index";

describe("@metweave/leaflet", () => {
  it("exports the adapter marker", () => {
    expect(leafletEntry.adapter).toBe("leaflet");
  });
});
