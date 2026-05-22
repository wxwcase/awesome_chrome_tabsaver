# Tab Saver

Chrome extension (Manifest V3) that saves every open tab across every Chrome window when you click the toolbar icon, and lets you reopen recent collections from the right-click "Load tab collection" submenu.

The source is `background.ts` (with helpers in `lib.ts`); it compiles to `background.js`, which is what Chrome actually loads. There's no bundler — just `tsc`.

![Tab Saver UI workflows: save flow with badge feedback, right-click menu structure, and multi-window save round-trip](assets/ui-workflows.jpg)

## Features

- **One-click save across all windows.** Click the toolbar icon to capture every tab in every Chrome window into a single collection. Each captured tab records its URL, title, and original window. A desktop notification confirms the save.
- **Persistent badge with the latest count.** A blue badge on the toolbar icon shows the number of tabs in your **most recent** saved collection. It survives browser restarts and updates whenever you save, delete, or clear. Right after a save the badge briefly flashes **green** for 3 seconds, then settles back to blue.
- **Skip duplicate saves.** If your tab list (URLs and order) is identical to the most recent saved collection, the click is a no-op — no new entry, no notification. Repeated clicks won't pollute history.
- **Right-click to manage a collection.** The "Load tab collection" submenu lists your **3 most recent** snapshots (most recent first), each labeled with its save timestamp and tab count. Each entry expands into an **Open** / **Delete** submenu — Open reopens the URLs as new windows (**preserving the original multi-window grouping**, so a save that spanned three windows reopens as three windows); Delete removes just that entry from storage.
- **One-click clear.** Right-click the extension **icon** → "Clear all saved tab collections (N)" wipes every saved collection and clears the badge. The menu item is disabled when there's nothing to clear.
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
npm run build       # one-shot tsc compile
npm run watch       # tsc --watch during active development
```

Output: `dist/background.js` (and `dist/lib.js`). `tsconfig.json` targets `outDir: ./dist` and excludes test files so `dist/` stays Chrome-loadable.

**Amazon Brazil:**

```sh
brazil-build        # runs the package's build (tsc + npm-pretty-much wiring)
```

Output: same `dist/background.js` and `dist/lib.js` — the Brazil flow honors the same `tsconfig.json`.

### 3. Load the unpacked extension into Chrome

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the directory **containing `manifest.json`** — the package root (not `dist/`). The manifest's `service_worker` points to `dist/background.js`, so Chrome loads the compiled output regardless of which build flow you used.

The extension's icon should appear in the toolbar. Pin it if you want it always visible.

### 4. Reload after changes

After every build, click the circular reload icon on the extension's card at `chrome://extensions`. Service-worker logs are under the **Inspect views: service worker** link on the same card.

> If you change `manifest.json` (especially `permissions`), a plain reload may not be enough — remove and re-load the unpacked extension so Chrome picks up the new permissions.

## Usage

- **Save** — click the toolbar icon. Every tab in every Chrome window is captured into a single collection. The toolbar badge flashes green for 3 seconds with the new collection's tab count, then settles back to blue. A desktop notification confirms the save and points to where the data lives (`chrome.storage.local`, browser-internal — not a regular file). If the URL list (in order) is identical to your most recent save, nothing new is recorded.
- **Reopen** — right-click anywhere on a page (or on the extension icon) → **Load tab collection** → pick a snapshot → **Open**. URLs are reopened grouped by their original window, so a multi-window save round-trips as multiple windows.
- **Delete one entry** — same path: **Load tab collection** → pick a snapshot → **Delete**. Removes only that entry; the badge updates to the new most-recent collection's count (or clears if nothing's left).
- **Clear all** — right-click the extension **icon** (action menu only) → **Clear all saved tab collections (N)**. One click wipes every saved collection and clears the badge.

## Developer

### Layout

```
tab-saver/
├── manifest.json              ← Chrome extension manifest (MV3)
├── src/
│   ├── background.ts          ← Service-worker entry: chrome.* listeners, menu rebuild, badge
│   ├── lib.ts                 ← Pure helpers (sameUrls, trim, nextRecent, …)
│   └── __tests__/lib.spec.ts  ← Vitest tests for lib.ts
├── dist/                      ← Compiled output. Loaded by Chrome. Don't edit by hand.
│   ├── background.js
│   └── lib.js
├── icon.png                   ← Toolbar icon
├── tsconfig.json              ← Strict TS, ES2022, DOM + chrome types; excludes tests
└── package.json               ← npm scripts: build, watch, test
```

`tsconfig.json` includes `src/**/*.ts` but **excludes** `src/__tests__/**`, so test files don't end up in the compiled output that Chrome loads. Vitest uses its own transform path.

### npm scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run build`   | One-shot `tsc` compile. Run before testing in Chrome.     |
| `npm run watch`   | `tsc --watch`. Use during active development.             |
| `npm test`        | Run vitest once and exit (CI-style).                      |

### Where to add code

- **Pure logic** (decision functions, predicates, data transforms) → `src/lib.ts`. Add a test in `src/__tests__/lib.spec.ts` next to it.
- **Chrome API wiring** (event listeners, badge/notification side effects, context-menu rebuilds) → `src/background.ts`. Keep listeners thin; defer to helpers in `lib.ts` for any non-trivial decision.

This split is intentional: anything in `lib.ts` is testable without mocking `chrome.*`, and `background.ts` stays small enough to read top-to-bottom.

### Service-worker quirks

The MV3 service worker is short-lived — Chrome can suspend it between events. State that needs to outlive a single click goes in `chrome.storage.local`. Don't rely on module-level variables for persistence (anything you stash in a `let` may be gone by the next event).

When debugging, the **Inspect views: service worker** link on `chrome://extensions` opens DevTools attached to the worker. If the link reads "(inactive)", click the extension icon once to wake it.

### Testing

Tests run on Node — no Chrome required. They cover only the pure helpers in `lib.ts`. To add a test:

```sh
# Run a single test file
npx vitest run src/__tests__/lib.spec.ts

# Watch mode while editing
npx vitest
```

Listener-level tests (mocking `chrome.*`) aren't set up. The bulk of decision logic lives in `lib.ts`; if you push more logic into `background.ts`, consider extracting it back so it stays testable.

### Shipping a change

1. `npm run build` (or have `npm run watch` running).
2. `npm test` — make sure helpers still pass.
3. Click reload on the extension's `chrome://extensions` card.
4. Open the service-worker DevTools and exercise the change. Save, reopen, delete-one, and clear-all all hit different code paths; the badge should stay in sync with `recent[0]`.
