import { matchesQuery, planDomainGroups } from "./lib.js";

const input = document.getElementById("q") as HTMLInputElement;
const results = document.getElementById("results") as HTMLDivElement;
const sub = document.getElementById("sub") as HTMLParagraphElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const groupBtn = document.getElementById("group") as HTMLButtonElement;
const showAllBtn = document.getElementById("show-all") as HTMLButtonElement;

let tabs: chrome.tabs.Tab[] = [];
let showAll = false;

(async () => {
  await refresh();
})();

input.addEventListener("input", () => {
  showAll = false;
  render(input.value);
});
saveBtn.addEventListener("click", handleSave);
groupBtn.addEventListener("click", handleGroup);
showAllBtn.addEventListener("click", () => {
  showAll = true;
  render(input.value);
});

chrome.tabs.onCreated.addListener(refresh);
chrome.tabs.onRemoved.addListener(refresh);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.title || change.url || change.status === "complete") refresh();
});

async function refresh(): Promise<void> {
  tabs = await chrome.tabs.query({});
  const windows = new Set(tabs.map((t) => t.windowId));
  sub.textContent = `${tabs.length} open tab${tabs.length === 1 ? "" : "s"} across ${windows.size} window${windows.size === 1 ? "" : "s"}.`;
  render(input.value);
}

async function handleSave(): Promise<void> {
  saveBtn.disabled = true;
  const original = saveBtn.textContent;
  const response = (await chrome.runtime.sendMessage({ type: "save-tabs" })) as
    | { ok: true; saved: boolean; count: number }
    | { ok: false; error: string }
    | undefined;
  if (!response || !response.ok) {
    saveBtn.textContent = "Save failed";
    setTimeout(() => {
      saveBtn.textContent = original;
      saveBtn.disabled = false;
    }, 1500);
    return;
  }
  saveBtn.classList.add("saved");
  saveBtn.textContent = response.saved ? `Saved ${response.count} tab${response.count === 1 ? "" : "s"}` : "Already saved";
  setTimeout(() => {
    saveBtn.classList.remove("saved");
    saveBtn.textContent = original;
    saveBtn.disabled = false;
  }, 1500);
}

async function handleGroup(): Promise<void> {
  groupBtn.disabled = true;
  const original = groupBtn.textContent;
  try {
    const winTabs = await chrome.tabs.query({ currentWindow: true, pinned: false });
    const plan = planDomainGroups(winTabs.map((t) => ({ id: t.id, url: t.url })));
    for (const { domain, tabIds } of plan) {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title: domain });
    }
    groupBtn.classList.add("grouped");
    groupBtn.textContent = `Grouped ${plan.length} domain${plan.length === 1 ? "" : "s"}`;
  } catch {
    groupBtn.textContent = "Group failed";
  }
  setTimeout(() => {
    groupBtn.classList.remove("grouped");
    groupBtn.textContent = original;
    groupBtn.disabled = false;
  }, 1500);
}

function render(query: string): void {
  const q = query.trim();
  if (q === "" && !showAll) {
    results.replaceChildren();
    return;
  }
  const hits = showAll || q === "" ? tabs.slice() : tabs.filter((t) => matchesQuery({ title: t.title, url: t.url }, q));
  if (hits.length === 0) {
    results.innerHTML = `<div class="empty">No open tabs match "${escapeHtml(q)}".</div>`;
    return;
  }

  const groups = new Map<number, chrome.tabs.Tab[]>();
  for (const t of hits) {
    const list = groups.get(t.windowId) ?? [];
    list.push(t);
    groups.set(t.windowId, list);
  }

  const frag = document.createDocumentFragment();
  let i = 1;
  for (const [windowId, groupHits] of groups) {
    groupHits.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }));
    frag.appendChild(renderGroup(`Window ${i++}`, windowId, groupHits, q));
  }
  results.replaceChildren(frag);
}

function renderGroup(label: string, windowId: number, hits: chrome.tabs.Tab[], q: string): HTMLElement {
  const group = document.createElement("div");
  group.className = "group";

  const header = document.createElement("div");
  header.className = "group-header";
  header.innerHTML = `<span class="when">${escapeHtml(label)}</span><span class="meta">${hits.length} match${hits.length === 1 ? "" : "es"}</span>`;
  const focus = document.createElement("button");
  focus.textContent = "Focus";
  focus.addEventListener("click", () => chrome.windows.update(windowId, { focused: true }));
  header.appendChild(focus);
  group.appendChild(header);

  for (const t of hits) {
    group.appendChild(renderRow(t, q));
  }
  return group;
}

function renderRow(tab: chrome.tabs.Tab, q: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  row.title = "Switch to this tab";
  row.addEventListener("click", async () => {
    if (tab.id == null) return;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  });

  const left = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.className = "title";
  titleEl.innerHTML = highlight(tab.title ?? "(no title)", q);
  const urlEl = document.createElement("div");
  urlEl.className = "url";
  urlEl.innerHTML = highlight(tab.url ?? "", q);
  left.appendChild(titleEl);
  left.appendChild(urlEl);

  const actions = document.createElement("div");
  actions.className = "actions";

  const closeBtn = document.createElement("button");
  closeBtn.className = "danger close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close tab";
  closeBtn.setAttribute("aria-label", "Close tab");
  closeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (tab.id == null) return;
    await chrome.tabs.remove(tab.id);
  });

  actions.appendChild(closeBtn);

  row.appendChild(left);
  row.appendChild(actions);
  return row;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function highlight(text: string, q: string): string {
  const safe = escapeHtml(text);
  if (q === "") return safe;
  const safeQ = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(safeQ, "gi"), (m) => `<mark>${m}</mark>`);
}
