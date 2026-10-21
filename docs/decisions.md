# Reference review and MVP decisions

Reviewed 2026-10-21. These are sources of workflow ideas; no third-party extension was installed for comparison and no source code was transplanted from them.

- The historical local prototype combined fuzzy folder selection, saving the current tab, keyboard handling and a separate global hierarchy sort. The useful carry-forward is quick folder finding and placement. The MVP leaves the existing collection’s order and hierarchy alone, uses native controls, validates saves and reports results explicitly.
- [Bookmark Search](https://chromewebstore.google.com/detail/bookmark-search/hhmokalkpaiacdofbcddkogifepbaijk) demonstrates the keyword/address-bar retrieval workflow. Its current listing describes a Manifest V3 migration and removal of bookmarklet execution. Busting Bookmarks uses `bb` to avoid taking over its `bm` keyword, and keeps non-web entries searchable as text.
- [Better Bookmark’s README](https://github.com/ardcore/chrome-better-bookmark) describes spotlight-like folder selection with keyboard/mouse support. Full ancestor paths make similarly named nested folders easier to distinguish. Its JavaScript source could not be retrieved through the web reader; the review used its README and the local historical prototype.
- [Save to Pocket](https://github.com/Pocket/extension-save-to-pocket) illustrates a short capture/confirmation flow with subsequent organization actions. [Pocket New Tab](https://github.com/Pocket/extension-pocket-new-tab) illustrates discovery/rediscovery, but its curated feed and new-tab replacement are outside this MVP. [Pocket’s monorepo](https://github.com/Pocket/pocket-monorepo) describes backend services and is marked historical following Pocket’s July 8, 2025 shutdown. No Pocket service or account integration is implemented.

## Native model

[Chrome’s Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks) supplies the ordered tree, native IDs, titles, URLs and available timestamps. Existing data stays in the browser. HTML remains the browser’s portable export/import path. Extra tags, reasons for saving or reading state would need a deliberate supplemental format; they are not silently encoded into native titles or addresses.

The API distinguishes browser-provided folders from managed/read-only nodes. Browser-provided bar/other folders can accept new children; the root and managed subtrees are not save destinations. Folder-path validation catches ancestor renames or moves before saving. It cannot make external changes and a subsequent create call atomic.

[ActiveTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) is sufficient for invoked page metadata; broad tab access, content scripts and page extraction are unnecessary here. [Omnibox documentation](https://developer.chrome.com/docs/extensions/reference/api/omnibox) defines keyword entry, escaped suggestion descriptions and disposition behavior. The worker only reads for explicit interactions and serializes saves. It does not keep an idle catalog.

## Scale and interface

The initial experiment seeded 20,000 synthetic bookmarks and proved native tree reading plus a nested-folder save without changing an existing bookmark’s fields. On that run, tree reading took about 39 ms. Subsequent browser checks separately measure native read, indexing and query time; they are observations on one machine, not guaranteed latency on all devices.

A temporary in-memory index normalizes title, URL text and ancestor path once per read. Queries match all words across those fields. Deterministic ranking, dates and title order are sufficient for this slice; fuzzy/semantic search needs actual missed-query examples before adding a dependency. Twenty rendered results and fifty folder choices keep the DOM bounded.

Plain TypeScript and native controls cover the current two views. A full-page view shares the same template. The core logic remains separate from rendering so a richer reading/review interface can be introduced later without replacing native bookmarks.
