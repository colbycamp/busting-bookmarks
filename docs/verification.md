# Verification — 2026-10-21

Build and **12 test groups passed**. Tests cover metadata/ancestry preservation, empty and managed folders, cross-field matching, case/accents/decoded URL text, relevance/date/numeric-title ordering, stable ties, pagination at 20,000 items, deep trees, exact address semantics, literal markup escaping, valid saves, stale/read-only destinations, deliberate duplicates, native-create failures and preference-write failures.

## Actual extension

The built extension was loaded in a fresh Brave profile reporting Chromium **155.0.8059.80**. The fixture created 20,003 synthetic bookmarks through the native API and later added a few synthetic write/link cases. No normal browser profile or private bookmark export was used.

Passed:

- Search by title, URL and ancestor path; no results; 20-row pagination; markup-like titles rendered as text. The complete native tree matched its prior snapshot after read-only searching/paging.
- An explicitly clicked result opened its synthetic loopback page in a new tab.
- Saving created a native bookmark in a deeply nested folder with its query and fragment retained. A pre-existing bookmark’s native fields were unchanged.
- Already-saved addresses required explicit consent for a second copy. Competing identical requests were serialized to one save and one existing-copy result.
- Only the last-folder ID appeared in extension local storage; the remembered destination survived opening a separate full-library page.
- External edits produced a stale notice. A changed destination path was rejected before creation.
- Chromium’s actual extension-action test API opened the real toolbar popup on a synthetic page. It captured the page’s correct title and complete URL with `activeTab`; no broad `tabs` permission was added.
- Keyboard operation of the tab strip and both views at 320 CSS pixels with 200% text enlargement. Screenshots were visually inspected; no document-level horizontal overflow was found. Expanded page-detail editing can scroll vertically in a toolbar popup.

On the final unthrottled native-browser run, reading the 20,003-item tree took about **36 ms**, indexing about **21 ms**, and five individual searches about **0.4–2.6 ms**. These are single-machine observations, not guarantees for all libraries or devices. The default Find layout measured about 553 CSS pixels high.

## Accessibility and document audits

Seven actual extension states passed axe WCAG A/AA tags through 2.2 and best-practice rules with **zero violations and zero incomplete findings**: Find, empty search, editable page details, save-ready, saved/duplicate notice, stale recovery, and the actual toolbar Save view. The extension Lighthouse accessibility snapshot scored **100**.

Identical built HTML/CSS/JS were also served on loopback with an in-memory adapter containing the full synthetic native snapshot:

| Lighthouse category | Desktop | Mobile emulation |
| --- | ---: | ---: |
| Performance | 100 | 98 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |

These are document/harness measurements. They include fixture initialization and are not extension-startup performance measurements or SEO claims about a private extension. The test keeps exact scores and uses a performance budget of 95, with the other categories gated at 100; it does not establish a permanent 100 score across timing variations. **The mobile performance score has not reached 100 in this run.**

The versioned [summary](verification.json) records the final run. Full machine-generated reports and screenshots are retained locally in ignored `audit-results/`. Run `npm run check:browser` with `BROWSER_PATH` to reproduce fresh evidence.

## Remaining checks

- Normal-profile use and search relevance on a real varied collection.
- Real address-bar suggestion/modifier-key interaction and user-assigned extension shortcut.
- VoiceOver and other screen readers, actual browser zoom on the user’s setup, branded Google Chrome, and additional operating systems.
- Managed-bookmark policies in a real managed profile; current automated coverage uses model fixtures.
- Forced worker termination/lost acknowledgements and every possible external edit between validation and native creation. The implementation does not claim atomic collection transactions.
- Actual browser HTML export/import round-trip; the extension uses the existing native collection and does not implement its own converter.

Next step: follow the [manual checklist](manual-test.md) with a small native test folder, then supply one successful and one missed search example.
