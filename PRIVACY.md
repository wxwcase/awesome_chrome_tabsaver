# Privacy Policy — Tab Saver

_Last updated: 2026-06-19_

Tab Saver ("the extension") is a Chrome extension that saves the tabs you have
open and lets you reload recent collections from a popup and right-click menu.
This policy explains exactly what data the extension touches and how it is
handled.

## Summary

**Tab Saver does not collect, transmit, or sell any personal data.** All data
stays on your own device. There are no servers, no analytics, and no third
parties involved.

## What data the extension accesses

When you save a collection, the extension reads, for each open tab:

- the tab's **URL**
- the tab's **title**
- the tab's **window ID** (an in-browser identifier, not a personal ID)

This data is only read at the moment you ask the extension to save your tabs.

## How the data is used and stored

- Saved collections are written to **`chrome.storage.local`**, which is storage
  on your own computer managed by Chrome.
- The data is used solely to display your recent collections and to reopen those
  tabs when you choose to.
- The data **never leaves your device**. It is not sent to the developer, to any
  server, or to any third party.
- Older collections are automatically trimmed to stay within a local storage
  limit. Uninstalling the extension removes all stored collections.

## Permissions and why they are needed

| Permission     | Why it is requested                                                        |
|----------------|----------------------------------------------------------------------------|
| `tabs`         | Read the URL and title of open tabs so they can be saved as a collection.  |
| `tabGroups`    | Organize the current window's tabs into native Chrome tab groups by domain when you click "Group tabs". |
| `storage`      | Persist saved collections locally in `chrome.storage.local`.               |
| `contextMenus` | Provide a right-click menu to reload a saved collection.                   |
| `notifications`| Show a confirmation when a collection is saved.                            |

## Data sharing

We do **not** sell, trade, or transfer your data to anyone. No data is shared
because no data ever leaves your device.

## Children's privacy

The extension does not knowingly collect any data from anyone, including
children.

## Changes to this policy

If this policy changes, the updated version will be posted at this same URL with
a new "Last updated" date.

## Contact

If you have questions about this privacy policy, please open an issue at
<https://github.com/wxwcase/awesome_chrome_tabsaver/issues>.
