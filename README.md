# Busting Bookmarks

A small Chrome/Chromium extension for finding native bookmarks and saving pages into existing folders. Developed and tested in Brave. No runtime dependencies.

## Load it locally

1. Open `brave://extensions` or `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this checkout’s **`dist`** folder. A local build is ready after the build command below.
3. Pin **Busting Bookmarks** in the Extensions menu. After a rebuild, click **Reload** on its extension card.

For keyboard invocation, assign a shortcut in `brave://extensions/shortcuts` or `chrome://extensions/shortcuts`. No default shortcut replaces a browser bookmarking command.

## Find

Open the toolbar popup and type words from a bookmark’s **title, address, or complete folder path**. Every word must match somewhere across those fields. For example, `hooks learning` can match a bookmark titled “Hooks & state” inside `Learning / Programming / React`.

Search ignores case and accents. It includes decoded URL text where possible, while keeping the stored address intact. It uses literal word fragments, not regular expressions, typo correction or semantic search. Search text is limited to 200 characters. It cannot find an article’s argument when those words are absent from its bookmark metadata.

**Best match** favors title matches. **Newest saved** and natural **Title** ordering are also available. With no query, Best match shows the newest saved bookmarks. Missing native dates remain missing. Results show the title, full folder path, full URL and saved date when available.

Only 20 results are rendered at once. Previous/Next browse the result set; **Open full page** offers more space and carries over the query. HTTP/HTTPS results open in new tabs. Other native bookmark types remain searchable as text; this version does not execute bookmarklets or open non-web addresses.

The address bar also has a `bb` keyword: type `bb`, press Tab or Space, then search. It offers up to five web-bookmark suggestions using the same matching rules. Choosing one uses the browser’s current/new/background-tab disposition. Submitting ordinary search text opens the full library. This interaction still needs a manual address-bar check in a normal browser profile.

## Save a page

Invoke the toolbar popup on a web page, then choose **Save a page**. The invoked page’s title and full URL are filled in. Expand **Page details** to review or edit them. You can also paste an HTTP/HTTPS address manually, including in the full-page view.

Type words from the destination’s full folder path, choose it in **Save into**, review **Destination**, then click **Save bookmark**. Folder search works across ancestors, distinguishes the displayed paths of nested folders, and includes empty folders. It shows at most 50 matching destinations; type more to narrow the list. The last folder successfully saved into is remembered on this device.

An existing matching address shows its current folder paths. Another copy requires checking **Save another copy in the selected folder** and explicitly saving. Matching uses browser URL normalization, including hostname case and default URL serialization; meaningful query parameters, their order, and fragments remain significant. Existing copies stay in place.

Saving creates one native bookmark. Search and Refresh do not write bookmarks. This version does not delete, move, rename, sort, or replace existing bookmarks/folders. A normal browser save can update its parent folder’s native modified time. Bookmark synchronization continues according to the browser’s own settings.

## Existing data and HTML

The browser’s bookmark tree is the source of truth. Existing titles, URLs, hierarchy, ordering and native metadata remain in that collection. The extension maintains an in-memory search view while in use. It does not import a second copy of the library or modify exported files.

Continue using the browser’s bookmark manager for standard **HTML export/import**, creating folders and other collection management. HTML is the portable browser interchange format; the extension accesses bookmarks through the native API. No custom HTML exporter is included, so there is no new conversion path that drops attributes or flattens folders.

## Permissions and data flow

- **`bookmarks`** reads the native bookmark tree and creates a bookmark only after Save. The browser grants this permission broadly; the implemented writes are limited to creation.
- **`activeTab`** supplies the invoked page’s title/URL. There is no broad `tabs`, history, content-script, or all-sites permission. Page bodies and favicons are not fetched.
- **`storage`** remembers one string, `last-folder-v1`, in local extension storage. It contains a folder ID, not bookmark contents or search history. There is no synchronized extension database.
- No extension network requests, analytics, account, automatic crawling, health checks, or archive-provider submission. Opening a result visits that website normally. Native browser bookmark synchronization still applies.
- Reads happen when the UI is invoked/refreshed, while saving, or during explicit `bb` searches. Changes to bookmarks mark an open UI stale; Refresh updates it. There is no persistent background bookmark index or periodic scan.
- Incognito is disabled. All automated checks use a separate temporary profile and synthetic data.

The worker serializes save requests and re-reads the tree before creating anything. Missing/read-only destinations or changed destination paths stop the save. A newly appearing duplicate requires renewed acknowledgement. Native creation is a single browser operation, but the check and create are not an atomic transaction against external browser changes. If a popup closes or a response is lost, reopen and review existing copies before retrying. Successful creation is not reported as failed merely because remembering the folder preference fails.

## Build and verify

Use Node.js 24 and npm:

```sh
npm ci
npm test
npm run build
```

TypeScript compiles directly to extension modules; there is no runtime framework or bundler. Native controls and bounded result rendering keep this two-view MVP small. The core files are:

- `src/model.ts`: flatten native metadata, index paths, match/rank/page results, match folders and addresses.
- `src/save.ts`: validate save intent and preserve existing records, behind a small test port.
- `src/background.ts`: native API adapter, serialized saves, and on-demand address-bar suggestions.
- `src/app.ts`: accessible Find/Save views, current-page capture, folder selection, stale/error states.

`library.html` is generated from the same HTML template with a wider layout. PNG icons are checked in; their editable source is `icons/icon.svg`. To regenerate them, run `node scripts/icons.mjs` with `BROWSER_PATH` set as below.

Run actual browser checks:

```sh
BROWSER_PATH='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' npm run check:browser
```

This launches a temporary isolated profile, seeds 20,003 synthetic bookmarks through the native API, and removes the profile afterward. Fixture pages resolve synthetic `.example` names to a loopback server. The test profile enables Chromium’s extension-debugging API to trigger the real toolbar action; this is not a production manifest permission. Reports/screenshots go into ignored `audit-results/`.

See [verification](docs/verification.md), [manual tests](docs/manual-test.md), and [reference decisions](docs/decisions.md).

## Current boundary and next step

This slice improves native retrieval and capture. Folder creation/editing, bulk cleanup, HTML file analysis, extra notes/tags, resurfacing, keep/delete review, article extraction and Pocket-style reading features remain possible later choices.

Next step: try Find and Save in a normal Brave profile, verify that the folder workflow feels quicker, and report a search that should have found something but did not. Remote repository creation, pushing, publishing and store submission are separate actions.
