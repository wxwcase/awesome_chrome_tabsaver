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
