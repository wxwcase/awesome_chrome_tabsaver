# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chrome extension (Manifest V3) that saves all open tabs on toolbar-icon click and lets the user reopen recent collections from a right-click submenu. Source is `background.ts`, compiled to `background.js` by `tsc` (no bundler). The extension itself loads `manifest.json`, `background.js`, `icon.png` — keep `background.js` checked in alongside the source so the unpacked extension is loadable without running a build.

## Build / loading

1. `npm install` (first time only).
2. `npm run build` after editing `background.ts` — emits `background.js` next to the source. Use `npm run watch` during active work.
3. Open `chrome://extensions`, enable Developer mode, "Load unpacked" → select this directory.
4. After each rebuild, click the reload icon on the extension's card. Service-worker logs are under "Inspect views: service worker" on that card.

## Architecture

Everything runs in the MV3 service worker (`background.ts` → `background.js`). State lives in `chrome.storage.local` under the key `recent` — an array of `Collection` records (`{ savedAt, tabs: [{ url, title, windowId }] }`), newest first. Two limits cap storage in `trim()`: `MAX_ENTRIES_OVER_LIMIT` (1000) is a hard ceiling, then entries are popped from the tail until the serialized array fits under `MAX_BYTES` (1 MiB). The submenu only surfaces the first `MENU_VISIBLE` (3) entries; older ones still live in storage.

Three event entry points:

- `chrome.action.onClicked` — queries all tabs, builds a `Collection`, and short-circuits when `recent[0]` has the same URL list in the same order (`sameUrls`). Otherwise prepends, runs `trim`, persists, and calls `rebuildContextMenus`. Note: there is no `chrome.downloads` write — the JSON-file behavior in earlier versions is gone.
- `chrome.contextMenus.onClicked` — parses the index from menu IDs of the form `tab-saver-load-<i>`, looks up the collection in `recent`, and opens its URLs in a new window via `chrome.windows.create({ url: urls })`.
- `chrome.runtime.onInstalled` / `onStartup` — rebuild the context menu so the "Load tab collection" submenu reflects the persisted `recent` list across browser restarts.

`rebuildContextMenus` always calls `removeAll()` first, then recreates the root + children — menu IDs are tied to array indices, so any change to `recent` requires a full rebuild to keep the click handler's index parsing valid.

## Branches

This repo has a few branches, but only `main` is used for GitHub. When merging other branches into `main`, do NOT modify `main`'s `package.json` — keep the top-level `name`, `repository`, and `homepage` fields untouched so the GitHub project metadata stays intact.

## Permissions

Declared in `manifest.json`: `tabs` (read tab URLs/titles), `storage` (persist `recent`), `contextMenus` (the load submenu). If you add functionality that needs more, update `manifest.json` and reload the extension — Chrome won't grant new permissions to an already-loaded unpacked extension without a reload.
