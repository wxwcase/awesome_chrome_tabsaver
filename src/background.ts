import { type Collection, nextRecent } from "./lib.js";

const MENU_VISIBLE = 3;

interface Storage {
  recent?: Collection[];
}

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  // To save tabs across all Chrome windows, swap the query above for the line below.
  // const tabs = await chrome.tabs.query({});
  const collection: Collection = {
    savedAt: new Date().toISOString(),
    tabs: tabs.map((t) => ({ url: t.url, title: t.title, windowId: t.windowId })),
  };

  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  const updated = nextRecent(recent, collection);
  if (!updated) return;
  await chrome.storage.local.set({ recent: updated });

  await rebuildContextMenus();
  await showSaveFeedback(collection.tabs.length);
});

async function showSaveFeedback(count: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: "#1f8a3b" });
  await chrome.action.setBadgeText({ text: String(count) });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);

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

  const match = id.match(/^tab-saver-load-(\d+)$/);
  if (!match) return;

  const index = parseInt(match[1]!, 10);
  const { recent = [] } = (await chrome.storage.local.get("recent")) as Storage;
  const collection = recent[index];
  if (!collection || collection.tabs.length === 0) return;

  const urls = collection.tabs
    .map((t) => t.url)
    .filter((u): u is string => typeof u === "string");
  await chrome.windows.create({ url: urls, focused: true });
});

async function handleClearClick(): Promise<void> {
  await chrome.storage.local.set({ recent: [] });
  await rebuildContextMenus();
  await showClearFeedback();
}

async function showClearFeedback(): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: "#1f8a3b" });
  await chrome.action.setBadgeText({ text: "0" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
}

chrome.runtime.onInstalled.addListener(rebuildContextMenus);
chrome.runtime.onStartup.addListener(rebuildContextMenus);

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
      chrome.contextMenus.create({
        id: `tab-saver-load-${i}`,
        parentId: "tab-saver-root",
        title: `${when} (${c.tabs.length} tabs)`,
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
