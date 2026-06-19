import { describe, expect, it } from "vitest";
import {
  byteSize,
  type Collection,
  domainFromUrl,
  MAX_BYTES,
  matchesQuery,
  nextRecent,
  planDomainGroups,
  sameUrls,
  searchTabs,
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

describe("searchTabs", () => {
  const c0: Collection = {
    savedAt: "2026-05-22T10:00:00.000Z",
    tabs: [
      { url: "https://github.com/foo", title: "foo repo", windowId: 1 },
      { url: "https://docs.aws.amazon.com/x", title: "AWS docs", windowId: 1 },
    ],
  };
  const c1: Collection = {
    savedAt: "2026-05-21T10:00:00.000Z",
    tabs: [
      { url: "https://news.ycombinator.com", title: "Hacker News", windowId: 2 },
    ],
  };

  it("returns [] for empty/whitespace query", () => {
    expect(searchTabs([c0, c1], "")).toEqual([]);
    expect(searchTabs([c0, c1], "   ")).toEqual([]);
  });

  it("matches case-insensitively against title and URL", () => {
    expect(searchTabs([c0, c1], "GITHUB")).toHaveLength(1);
    expect(searchTabs([c0, c1], "aws docs")).toHaveLength(1);
  });

  it("returns hits with their collection and tab indices", () => {
    const hits = searchTabs([c0, c1], "news");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.collectionIndex).toBe(1);
    expect(hits[0]!.tabIndex).toBe(0);
    expect(hits[0]!.tab.url).toBe("https://news.ycombinator.com");
  });

  it("preserves recency order (newest collection first)", () => {
    const both: Collection = { savedAt: c0.savedAt, tabs: [...c0.tabs, { url: "https://foo.com", title: "shared foo", windowId: 1 }] };
    const older: Collection = { savedAt: c1.savedAt, tabs: [{ url: "https://foo.com", title: "older foo", windowId: 2 }] };
    const hits = searchTabs([both, older], "foo");
    expect(hits.map((h) => h.collectionIndex)).toEqual([0, 0, 1]);
  });

  it("tolerates undefined title/url", () => {
    const sparse: Collection = {
      savedAt: c0.savedAt,
      tabs: [{ url: undefined, title: undefined, windowId: 1 }, { url: "https://x.com", title: "x", windowId: 1 }],
    };
    expect(() => searchTabs([sparse], "x")).not.toThrow();
    expect(searchTabs([sparse], "x")).toHaveLength(1);
  });
});

describe("domainFromUrl", () => {
  it("extracts the hostname", () => {
    expect(domainFromUrl("https://github.com/foo/bar")).toBe("github.com");
  });

  it("strips a leading www.", () => {
    expect(domainFromUrl("https://www.github.com/foo")).toBe("github.com");
  });

  it("returns empty string for undefined or unparseable urls", () => {
    expect(domainFromUrl(undefined)).toBe("");
    expect(domainFromUrl("about:blank")).toBe("");
    expect(domainFromUrl("not a url")).toBe("");
  });
});

describe("planDomainGroups", () => {
  it("groups tab ids by domain", () => {
    const plan = planDomainGroups([
      { id: 1, url: "https://github.com/a" },
      { id: 2, url: "https://github.com/b" },
      { id: 3, url: "https://example.com/x" },
    ]);
    expect(plan).toEqual([
      { domain: "example.com", tabIds: [3] },
      { domain: "github.com", tabIds: [1, 2] },
    ]);
  });

  it("orders domains alphabetically", () => {
    const plan = planDomainGroups([
      { id: 1, url: "https://zebra.com/" },
      { id: 2, url: "https://apple.com/" },
      { id: 3, url: "https://mango.com/" },
    ]);
    expect(plan.map((g) => g.domain)).toEqual(["apple.com", "mango.com", "zebra.com"]);
  });

  it("treats www. and bare hosts as the same domain", () => {
    const plan = planDomainGroups([
      { id: 1, url: "https://www.github.com/a" },
      { id: 2, url: "https://github.com/b" },
    ]);
    expect(plan).toEqual([{ domain: "github.com", tabIds: [1, 2] }]);
  });

  it("skips tabs without an id or a groupable url", () => {
    const plan = planDomainGroups([
      { id: undefined, url: "https://github.com/a" },
      { id: 1, url: "about:blank" },
      { id: 2, url: undefined },
      { id: 3, url: "https://example.com/x" },
    ]);
    expect(plan).toEqual([{ domain: "example.com", tabIds: [3] }]);
  });
});

describe("matchesQuery", () => {
  it("matches title and URL case-insensitively", () => {
    expect(matchesQuery({ title: "Hacker News", url: "https://news.ycombinator.com" }, "HACKER")).toBe(true);
    expect(matchesQuery({ title: "Hacker News", url: "https://news.ycombinator.com" }, "ycombinator")).toBe(true);
  });

  it("returns false for empty/whitespace query", () => {
    expect(matchesQuery({ title: "x", url: "https://x.com" }, "")).toBe(false);
    expect(matchesQuery({ title: "x", url: "https://x.com" }, "   ")).toBe(false);
  });

  it("tolerates undefined fields", () => {
    expect(matchesQuery({ title: undefined, url: "https://x.com" }, "x")).toBe(true);
    expect(matchesQuery({ title: undefined, url: undefined }, "x")).toBe(false);
  });
});
