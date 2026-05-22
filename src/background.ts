import { type Collection, nextRecent } from "./lib.js";

const MENU_VISIBLE = 3;
const BADGE_COLOR_DEFAULT = "#3367d6";
const BADGE_COLOR_SAVED = "#1f8a3b";
const SAVE_FLASH_MS = 3000;

interface Storage {
  recent?: Collection[];
}

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const collection: Collection = {
    savedAt: new Date().toISOString(),
    tabs: tabs.map((t) => ({ url: t.url, title: t.title, windowId: t.windowId })),
  };

  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  const updated = nextRecent(recent, collection);
  if (!updated) return;
  await chrome.storage.local.set({ recent: updated });

  await rebuildContextMenus();
  await flashSaveBadge(updated);
  showSaveNotification(collection.tabs.length);
});

async function updateBadge(recent: Collection[]): Promise<void> {
  const latest = recent[0];
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_DEFAULT });
  await chrome.action.setBadgeText({ text: latest ? String(latest.tabs.length) : "" });
}

async function flashSaveBadge(recent: Collection[]): Promise<void> {
  const latest = recent[0];
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_SAVED });
  await chrome.action.setBadgeText({ text: latest ? String(latest.tabs.length) : "" });
  setTimeout(() => updateBadge(recent), SAVE_FLASH_MS);
}

function showSaveNotification(count: number): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: `Saved ${count} tab${count === 1 ? "" : "s"}`,
    message:
      "Stored in chrome.storage.local — browser-internal, not a regular file. " +
      "On macOS: ~/Library/Application Support/Google/Chrome/<Profile>/Local Extension Settings/<extension-id>/",
    priority: 0,
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const id = String(info.menuItemId);

  if (id === "tab-saver-clear") {
    await handleClearClick();
    return;
  }

  const openMatch = id.match(/^tab-saver-open-(\d+)$/);
  if (openMatch) {
    await handleOpenClick(parseInt(openMatch[1]!, 10));
    return;
  }

  const deleteMatch = id.match(/^tab-saver-delete-(\d+)$/);
  if (deleteMatch) {
    await handleDeleteClick(parseInt(deleteMatch[1]!, 10));
    return;
  }
});

async function handleOpenClick(index: number): Promise<void> {
  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  const collection = recent[index];
  if (!collection || collection.tabs.length === 0) return;

  const groups = new Map<number, string[]>();
  for (const t of collection.tabs) {
    if (typeof t.url !== "string") continue;
    const list = groups.get(t.windowId) ?? [];
    list.push(t.url);
    groups.set(t.windowId, list);
  }

  let first = true;
  for (const urls of groups.values()) {
    if (urls.length === 0) continue;
    await chrome.windows.create({ url: urls, focused: first });
    first = false;
  }
}

async function handleDeleteClick(index: number): Promise<void> {
  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  if (index < 0 || index >= recent.length) return;
  const updated = recent.slice(0, index).concat(recent.slice(index + 1));
  await chrome.storage.local.set({ recent: updated });
  await rebuildContextMenus();
  await updateBadge(updated);
}

async function handleClearClick(): Promise<void> {
  await chrome.storage.local.set({ recent: [] });
  await rebuildContextMenus();
  await updateBadge([]);
}

async function restoreState(): Promise<void> {
  await rebuildContextMenus();
  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  await updateBadge(recent);
}

chrome.runtime.onInstalled.addListener(restoreState);
chrome.runtime.onStartup.addListener(restoreState);

async function rebuildContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();

  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  const top = recent.slice(0, MENU_VISIBLE);

  chrome.contextMenus.create({
    id: "tab-saver-root",
    title: "Load tab collection",
    contexts: ["page", "action"],
  });

  if (top.length === 0) {
    chrome.contextMenus.create({
      id: "tab-saver-empty",
      parentId: "tab-saver-root",
      title: "(no collections yet)",
      enabled: false,
      contexts: ["page", "action"],
    });
  } else {
    top.forEach((c, i) => {
      const when = new Date(c.savedAt).toLocaleString();
      const entryId = `tab-saver-entry-${i}`;
      chrome.contextMenus.create({
        id: entryId,
        parentId: "tab-saver-root",
        title: `${when} (${c.tabs.length} tabs)`,
        contexts: ["page", "action"],
      });
      chrome.contextMenus.create({
        id: `tab-saver-open-${i}`,
        parentId: entryId,
        title: "Open",
        contexts: ["page", "action"],
      });
      chrome.contextMenus.create({
        id: `tab-saver-delete-${i}`,
        parentId: entryId,
        title: "Delete",
        contexts: ["page", "action"],
      });
    });
  }

  chrome.contextMenus.create({
    id: "tab-saver-clear",
    title: `Clear all saved tab collections (${recent.length})`,
    contexts: ["action"],
    enabled: recent.length > 0,
  });
}
