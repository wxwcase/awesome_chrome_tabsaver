# Tab Saver

Chrome extension (Manifest V3) that saves the open tabs in your current window when you click the toolbar icon, and lets you reopen recent collections from the right-click "Load tab collection" submenu.

The source is `background.ts` (with helpers in `lib.ts`); it compiles to `background.js`, which is what Chrome actually loads. There's no bundler — just `tsc`.

## Installation

### 1. Install build dependencies (first time only)

You need [Node.js](https://nodejs.org/) (with `npm`) installed.

```sh
npm install
```

This installs `typescript`, `@types/chrome`, and `vitest` into `node_modules/`. Nothing is installed globally.

### 2. Build

```sh
npm run build
```

This compiles `background.ts` (and `lib.ts`) to `background.js` next to the source. You only need to rebuild after editing the `.ts` files. For active development, use `npm run watch` to recompile on save.

### 3. Load the unpacked extension into Chrome

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select this project's directory (the one containing `manifest.json`).

The extension's icon should appear in the toolbar. Pin it if you want it always visible.

### 4. Reload after changes

After every `npm run build`, click the circular reload icon on the extension's card at `chrome://extensions`. Service-worker logs are under the **Inspect views: service worker** link on the same card.

> If you change `manifest.json` (especially `permissions`), a plain reload may not be enough — remove and re-load the unpacked extension so Chrome picks up the new permissions.

## Usage

- **Save** — click the toolbar icon. Tabs in the current window are captured into a collection. A green count badge shows on the icon for a few seconds and a desktop notification confirms the save and tells you where the data lives (in `chrome.storage.local`, browser-internal — not a regular file). If the URL list (in order) is identical to your most recent save, nothing new is recorded.
- **Reopen** — right-click anywhere on a page (or on the extension icon) → **Load tab collection** → pick a snapshot. The URLs open in a new window.
- **Clear** — right-click the extension **icon** (action menu only) → **Clear all saved tab collections (N)**. One click wipes every saved collection; a green `0` badge briefly confirms the action.

The submenu shows the 3 most recent collections. Older collections still live in `chrome.storage.local` (capped at ~1 MiB / 1000 entries) but aren't surfaced in the menu today.

## Developer

### Layout

```
tab-saver/
├── manifest.json     ← Chrome extension manifest (MV3)
├── background.ts     ← Service-worker entry: chrome.* listeners, menu rebuild
├── lib.ts            ← Pure helpers (sameUrls, trim, nextRecent, isClearArmed, …)
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

The MV3 service worker is short-lived — Chrome can suspend it between events. State that needs to outlive a single click goes in `chrome.storage.local`. Don't rely on module-level variables for persistence (e.g. the clear-confirm timer uses `clearArmedAt` in storage, not a JS variable).

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
