import { describe, expect, it } from "vitest";
import {
  byteSize,
  type Collection,
  MAX_BYTES,
  nextRecent,
  sameUrls,
  trim,
} from "../lib.js";

const tab = (url: string, title = url, windowId = 1) => ({ url, title, windowId });
const collection = (urls: string[], savedAt = "2026-05-22T00:00:00.000Z"): Collection => ({
  savedAt,
  tabs: urls.map((u) => tab(u)),
});

describe("sameUrls", () => {
  it("returns true for identical url sequences", () => {
    expect(sameUrls([tab("a"), tab("b")], [tab("a"), tab("b")])).toBe(true);
  });

  it("returns false when lengths differ", () => {
    expect(sameUrls([tab("a")], [tab("a"), tab("b")])).toBe(false);
  });

  it("returns false when order differs", () => {
    expect(sameUrls([tab("a"), tab("b")], [tab("b"), tab("a")])).toBe(false);
  });

  it("ignores title and windowId differences", () => {
    expect(sameUrls([tab("a", "old", 1)], [tab("a", "new", 7)])).toBe(true);
  });
});

describe("nextRecent", () => {
  it("prepends a new collection", () => {
    const prev = [collection(["a"])];
    const result = nextRecent(prev, collection(["b"]));
    expect(result).not.toBeNull();
    expect(result![0]!.tabs.map((t) => t.url)).toEqual(["b"]);
    expect(result![1]!.tabs.map((t) => t.url)).toEqual(["a"]);
  });

  it("returns null when candidate URLs match the head exactly", () => {
    const prev = [collection(["a", "b"])];
    expect(nextRecent(prev, collection(["a", "b"]))).toBeNull();
  });

  it("does not skip when prev is empty", () => {
    expect(nextRecent([], collection(["a"]))).not.toBeNull();
  });
});

describe("trim", () => {
  it("returns the list unchanged when under both caps", () => {
    const list = [collection(["a"]), collection(["b"])];
    expect(trim(list)).toHaveLength(2);
  });

  it("drops trailing entries until under MAX_BYTES", () => {
    const oversized = collection(Array.from({ length: 10000 }, (_, i) => `https://example.com/${"x".repeat(200)}/${i}`));
    const list = [collection(["fresh"]), oversized, oversized];
    const result = trim(list);
    expect(byteSize(result)).toBeLessThanOrEqual(MAX_BYTES);
    expect(result[0]!.tabs[0]!.url).toBe("fresh");
  });

  it("never trims below one entry", () => {
    const huge = collection(Array.from({ length: 50000 }, (_, i) => `https://example.com/${"x".repeat(200)}/${i}`));
    const result = trim([huge]);
    expect(result).toHaveLength(1);
  });
});

