# Manual test

The automated tests operate only on synthetic bookmarks in a temporary profile. This checklist is for a normal Brave/Chrome installation. Use a small dedicated test folder and harmless URLs for write checks.

1. Load this checkout’s `dist` folder at `brave://extensions` with Developer mode enabled. Pin the green bookmark icon. Check that the extension card has no Errors badge.
2. In the browser’s own bookmark manager, create a test folder and a nested child, such as `BB Test / Reading`. This version deliberately uses existing folders.
3. Open a harmless page such as `https://example.com/?bb-test=1#section`. Invoke the toolbar popup, then **Save a page**. Expand **Page details** and confirm that both the title and full address came from this page. Edit the title to something recognizable.
4. Type `bb reading` into **Find a destination folder**. Select the full matching path in **Save into**. Confirm the displayed Destination, then click **Save bookmark**. A success message should appear; the native bookmark manager should show the new bookmark in exactly that folder.
5. Close/reopen the popup. Confirm the last saved folder is remembered. The existing-address notice should show its folder path and keep Save disabled until **Save another copy** is explicitly checked. Optionally create a second synthetic copy and verify both remain; there is no automatic deduplication or deletion.
6. Use Find to search for words from that title together with `reading`. Confirm cross-field matching, full path, stored URL and saved date. Try capitalization, Best match/Newest/Title, an empty query, no matches, and Previous/Next when enough bookmarks match. Searching must not rearrange anything.
7. Click a result and confirm it opens in a new tab. Open **Open full page** and confirm the query carries over and the layout offers more space. In that page, manually pasted URLs can also be saved; its own extension tab is not a source article.
8. Keep the full library open and rename a selected test folder in the native bookmark manager. Expect a stale notice; Refresh must update the path. A removed destination must be reselected. Do not expect a stale folder choice to be used silently.
9. Try the address bar: type `bb`, press Tab or Space, then a search. Choose a suggestion and test ordinary Enter and the browser’s new-tab modifier. Also submit text without selecting a suggestion to open the full search view. This real address-bar interaction is not covered by the headless automated run.
10. Use Tab/Shift+Tab throughout. The Find/Save tab strip supports Left/Right and Home/End. Type folder words, press Enter to focus the destination selector, then use native arrow-key selection. Check visible focus, increased browser zoom, narrow windows and a screen reader. The automated checks do not replace VoiceOver testing.
11. A manually entered unsupported URL, such as `javascript:alert(1)`, must not enable saving. Existing non-web bookmarks may appear as text in search but should not become executable links.
12. Optional portability check: export bookmarks using the browser’s standard HTML export, then inspect only your synthetic entry’s title, address and folder. The extension does not provide a custom importer/exporter or change existing export files. Remove test entries through the browser manager when finished.

Send feedback about capture accuracy, folder selection, result relevance, any missing expected results, keyboard/zoom behavior, or exact error text. No private bookmark file is needed for debugging.
