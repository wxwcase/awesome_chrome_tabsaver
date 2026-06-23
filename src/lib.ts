export const MAX_BYTES = 1024 * 1024;
export const MAX_ENTRIES_OVER_LIMIT = 1000;

export interface SavedTab {
  url: string | undefined;
  title: string | undefined;
  windowId: number;
}

export interface Collection {
  savedAt: string;
  tabs: SavedTab[];
}

export function sameUrls(a: SavedTab[], b: SavedTab[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t.url === b[i]!.url);
}

export function byteSize(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}

export function trim(list: Collection[]): Collection[] {
  const trimmed = list.slice(0, MAX_ENTRIES_OVER_LIMIT);
  while (trimmed.length > 1 && byteSize(trimmed) > MAX_BYTES) {
    trimmed.pop();
  }
  return trimmed;
}

export function nextRecent(
  prev: Collection[],
  candidate: Collection,
): Collection[] | null {
  if (prev[0] && sameUrls(prev[0].tabs, candidate.tabs)) return null;
  return trim([candidate, ...prev]);
}

export interface GroupableTab {
  id: number | undefined;
  url: string | undefined;
}

export interface DomainGroup {
  domain: string;
  label: string;
  tabIds: number[];
}

export function domainFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Shortens each domain to a tab-group chip title by dropping its registrable
// domain + TLD (the last two labels): "somewebsite.amazon.com" → "somewebsite",
// "docs.aws.amazon.com" → "docs.aws". A bare two-label domain like "github.com"
// drops only the TLD, giving "github". If two distinct domains would collapse
// to the same title (e.g. somewebsite.amazon.com and somewebsite.google.com),
// the colliding ones keep one segment deeper until distinct, up to the full
// domain. Returns a map from each input domain to its title.
export function labelDomains(domains: string[]): Map<string, string> {
  const partsOf = new Map(domains.map((d) => [d, d.split(".")]));
  const keep = new Map<string, number>();
  for (const d of domains) {
    const n = partsOf.get(d)!.length;
    keep.set(d, Math.max(1, n - 2));
  }
  const labelOf = (d: string) => partsOf.get(d)!.slice(0, keep.get(d)!).join(".");

  for (;;) {
    const byLabel = new Map<string, string[]>();
    for (const d of domains) {
      const list = byLabel.get(labelOf(d)) ?? [];
      list.push(d);
      byLabel.set(labelOf(d), list);
    }
    let changed = false;
    for (const collided of byLabel.values()) {
      if (collided.length < 2) continue;
      for (const d of collided) {
        if (keep.get(d)! < partsOf.get(d)!.length) {
          keep.set(d, keep.get(d)! + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return new Map(domains.map((d) => [d, labelOf(d)]));
}

export function planDomainGroups(tabs: GroupableTab[]): DomainGroup[] {
  const byDomain = new Map<string, number[]>();
  for (const t of tabs) {
    if (typeof t.id !== "number") continue;
    const domain = domainFromUrl(t.url);
    if (domain === "") continue;
    const list = byDomain.get(domain) ?? [];
    list.push(t.id);
    byDomain.set(domain, list);
  }
  const labels = labelDomains([...byDomain.keys()]);
  return [...byDomain.keys()]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((domain) => ({ domain, label: labels.get(domain)!, tabIds: byDomain.get(domain)! }));
}

// chrome.tabGroups.TAB_GROUP_ID_NONE — the groupId of an ungrouped tab.
export const TAB_GROUP_ID_NONE = -1;

export interface PlacedTab extends GroupableTab {
  groupId: number;
}

export interface ExistingGroup {
  id: number;
  title: string | undefined;
}

// Like planDomainGroups, but drops domains that are already correctly grouped:
// all of the domain's tabs sit in one group, that group is titled with the
// domain's label, and the group holds no other tabs. Returns only the domains
// that still need (re)grouping, alphabetically.
export function domainGroupsToApply(
  tabs: PlacedTab[],
  groups: ExistingGroup[],
): DomainGroup[] {
  const titleById = new Map(groups.map((g) => [g.id, g.title]));
  const memberCount = new Map<number, number>();
  for (const t of tabs) {
    if (t.groupId !== TAB_GROUP_ID_NONE) {
      memberCount.set(t.groupId, (memberCount.get(t.groupId) ?? 0) + 1);
    }
  }

  const byDomain = new Map<string, { ids: number[]; groupIds: Set<number> }>();
  for (const t of tabs) {
    if (typeof t.id !== "number") continue;
    const domain = domainFromUrl(t.url);
    if (domain === "") continue;
    const entry = byDomain.get(domain) ?? { ids: [], groupIds: new Set<number>() };
    entry.ids.push(t.id);
    entry.groupIds.add(t.groupId);
    byDomain.set(domain, entry);
  }

  const labels = labelDomains([...byDomain.keys()]);
  const result: DomainGroup[] = [];
  for (const domain of [...byDomain.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  )) {
    const { ids, groupIds } = byDomain.get(domain)!;
    const label = labels.get(domain)!;
    const onlyGroup = groupIds.size === 1 ? [...groupIds][0]! : null;
    const satisfied =
      onlyGroup !== null &&
      onlyGroup !== TAB_GROUP_ID_NONE &&
      titleById.get(onlyGroup) === label &&
      memberCount.get(onlyGroup) === ids.length;
    if (!satisfied) result.push({ domain, label, tabIds: ids });
  }
  return result;
}

export interface SearchHit {
  collectionIndex: number;
  tabIndex: number;
  savedAt: string;
  collectionSize: number;
  tab: SavedTab;
}

export function searchTabs(recent: Collection[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const hits: SearchHit[] = [];
  recent.forEach((c, ci) => {
    c.tabs.forEach((t, ti) => {
      if (matchesQuery(t, q)) {
        hits.push({
          collectionIndex: ci,
          tabIndex: ti,
          savedAt: c.savedAt,
          collectionSize: c.tabs.length,
          tab: t,
        });
      }
    });
  });
  return hits;
}

export function matchesQuery(
  tab: { url?: string; title?: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return false;
  const title = tab.title?.toLowerCase() ?? "";
  const url = tab.url?.toLowerCase() ?? "";
  return title.includes(q) || url.includes(q);
}
