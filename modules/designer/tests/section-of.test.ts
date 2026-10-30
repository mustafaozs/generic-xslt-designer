import { describe, it, expect } from "vitest";
import * as publicApi from "../src";
import { sectionOf } from "../src/internal";

const tpl: any = {
  sections: [
    { id: "header", blocks: [{ id: "b1" }] },
    { id: "body", blocks: [{ id: "b2" }] }
  ]
};

describe("sectionOf (internal)", () => {
  it("returns the section id of an existing block", () => {
    expect(sectionOf(tpl, "b2")).toBe("body");
    expect(sectionOf(tpl, "b1")).toBe("header");
  });
  it("returns undefined for an unknown block id", () => {
    expect(sectionOf(tpl, "nope")).toBeUndefined();
  });
  it("is not part of the public surface", () => {
    expect(Object.keys(publicApi)).not.toContain("sectionOf");
  });
});
