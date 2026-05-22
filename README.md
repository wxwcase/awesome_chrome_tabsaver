# Tab Saver

Chrome extension (Manifest V3) that saves every open tab across every Chrome window when you click the toolbar icon, and lets you reopen recent collections from the right-click "Load tab collection" submenu.

The source is `background.ts` (with helpers in `lib.ts`); it compiles to `background.js`, which is what Chrome actually loads. There's no bundler — just `tsc`.

## Features

- **One-click save across all windows.** Click the toolbar icon to capture every tab in every Chrome window into a single collection. Each captured tab records its URL, title, and original window. A green count badge on the icon and a desktop notification confirm the save.
- **Skip duplicate saves.** If your tab list (URLs and order) is identical to the most recent saved collection, the click is a no-op — no new entry, no badge, no notification. Repeated clicks won't pollute history.
- **Right-click to reload a collection.** The "Load tab collection" submenu lists your **3 most recent** snapshots (most recent first), each labeled with its save timestamp and tab count. Picking one reopens those URLs as new windows, **preserving the original multi-window grouping** — a save that spanned three windows reopens as three windows.
- **One-click clear.** Right-click the extension **icon** → "Clear all saved tab collections (N)" wipes every saved collection. A green `0` badge briefly confirms. The menu item is disabled when there's nothing to clear.
- **Storage caps.** Up to **1000 collections** are kept, and the entire `recent` array is trimmed (oldest first) to stay under **~1 MiB** when serialized. The most recent save is always kept, even if it would push you over the limit.
- **Visible storage location.** The post-save notification tells you that data lives in `chrome.storage.local` (browser-internal, not a regular file) and includes the on-disk path Chrome uses on macOS. Useful when you're wondering "where did that go?"
- **Persists across browser restarts.** Collections live in `chrome.storage.local`, so they survive Chrome restarts and the MV3 service worker being suspended between clicks.

> **Visibility vs. storage.** The right-click submenu only shows the 3 most recent collections, but older entries (up to the storage caps) still live in `chrome.storage.local`. They aren't surfaced in the UI today; you'd see them via DevTools or by extending the extension to render more.

## Installation

This package supports two workflows. Pick whichever matches where you have it checked out:

- **External / open-source** — uses `npm` and the public registry. Use this when the project lives outside an Amazon Brazil workspace (e.g. cloned to `~/Work/projects/tab-saver`).
- **Amazon Brazil** — uses `brazil-build` (a wrapper around `npm` that talks to Amazon's internal registry). Use this when the package is part of a Brazil workspace (e.g. `~/workplace/chrome_tabsaver/src/AwesomeChromeTabSaver`).

> The two flows are mutually exclusive in a given checkout — pick one and stick with it. Don't run plain `npm install` inside a Brazil workspace; it'll pull from the public registry instead of Amazon's internal one.

### 1. Install build dependencies (first time only)

You need [Node.js](https://nodejs.org/) (with `npm`) installed for either workflow.

**External:**

```sh
npm install
```

Installs `typescript`, `@types/chrome`, and `vitest` into `node_modules/`. Nothing is installed globally.

**Amazon Brazil:**

```sh
brazil-build install
```

Same idea, but resolves dependencies through the internal registry. Add registry deps with `brazil-build install <pkg>`. Brazil-package deps (those built by other Brazil packages) go in `Config` under `dependencies` / `test-dependencies`, with a matching `*` entry in `package.json`.

### 2. Build

**External:**

```sh
npm run build       # one-shot tsc compile next to the source
npm run watch       # tsc --watch during active development
```

Output: `background.js` next to `background.ts`.

**Amazon Brazil:**

```sh
brazil-build        # runs the package's build (tsc + npm-pretty-much wiring)
```

Output: `dist/background.js` (and `dist/lib.js`). The Brazil flow honors the package's `tsconfig.json`, which targets `outDir: ./dist` and excludes the test files so `dist/` stays Chrome-loadable.

### 3. Load the unpacked extension into Chrome

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the directory **containing `manifest.json`** — the package root (not `dist/`). The manifest's `service_worker` path tells Chrome where to find the compiled JS:
   - External flow → `background.js` (root)
   - Brazil flow → `dist/background.js`

The extension's icon should appear in the toolbar. Pin it if you want it always visible.

### 4. Reload after changes

After every build, click the circular reload icon on the extension's card at `chrome://extensions`. Service-worker logs are under the **Inspect views: service worker** link on the same card.

> If you change `manifest.json` (especially `permissions`), a plain reload may not be enough — remove and re-load the unpacked extension so Chrome picks up the new permissions.

## Usage

- **Save** — click the toolbar icon. Every tab in every Chrome window is captured into a single collection. A green count badge shows on the icon for a few seconds and a desktop notification confirms the save and points to where the data lives (`chrome.storage.local`, browser-internal — not a regular file). If the URL list (in order) is identical to your most recent save, nothing new is recorded.
- **Reopen** — right-click anywhere on a page (or on the extension icon) → **Load tab collection** → pick a snapshot. URLs are reopened grouped by their original window, so a multi-window save round-trips as multiple windows.
- **Clear** — right-click the extension **icon** (action menu only) → **Clear all saved tab collections (N)**. One click wipes every saved collection; a green `0` badge briefly confirms the action.

## Developer

### Layout

```
tab-saver/
├── manifest.json     ← Chrome extension manifest (MV3)
├── background.ts     ← Service-worker entry: chrome.* listeners, menu rebuild
├── lib.ts            ← Pure helpers (sameUrls, trim, nextRecent, …)
├── lib.test.ts       ← Vitest tests for lib.ts
├── background.js     ← Compiled output. Loaded by Chrome. Don't edit by hand.
├── icon.png          ← Toolbar icon
├── tsconfig.json     ← Strict TS, ES2022, DOM + chrome types
└── package.json      ← npm scripts: build, watch, test
```

`tsconfig.json` only includes `background.ts` and `lib.ts`, so the test file does **not** end up in the compiled output that Chrome loads. Vitest uses its own transform path.

### npm scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run build`   | One-shot `tsc` compile. Run before testing in Chrome.     |
| `npm run watch`   | `tsc --watch`. Use during active development.             |
| `npm test`        | Run vitest once and exit (CI-style).                      |

### Where to add code

- **Pure logic** (decision functions, predicates, data transforms) → `lib.ts`. Add a test in `lib.test.ts` next to it.
- **Chrome API wiring** (event listeners, badge/notification side effects, context-menu rebuilds) → `background.ts`. Keep listeners thin; defer to helpers in `lib.ts` for any non-trivial decision.

This split is intentional: anything in `lib.ts` is testable without mocking `chrome.*`, and `background.ts` stays small enough to read top-to-bottom.

### Service-worker quirks

The MV3 service worker is short-lived — Chrome can suspend it between events. State that needs to outlive a single click goes in `chrome.storage.local`. Don't rely on module-level variables for persistence (anything you stash in a `let` may be gone by the next event).

When debugging, the **Inspect views: service worker** link on `chrome://extensions` opens DevTools attached to the worker. If the link reads "(inactive)", click the extension icon once to wake it.

### Testing

Tests run on Node — no Chrome required. They cover only the pure helpers in `lib.ts`. To add a test:

```sh
# Run a single test file
npx vitest run lib.test.ts

# Watch mode while editing
npx vitest
```

Listener-level tests (mocking `chrome.*`) aren't set up. The bulk of decision logic lives in `lib.ts`; if you push more logic into `background.ts`, consider extracting it back so it stays testable.

### Shipping a change

1. `npm run build` (or have `npm run watch` running).
2. `npm test` — make sure helpers still pass.
3. Click reload on the extension's `chrome://extensions` card.
4. Open the service-worker DevTools and exercise the change. Save, reopen, and clear all hit different code paths.
