import { escapeXML, indexTree, search, webAddress } from './model.js';
import { saveBookmark, type SaveRequest } from './save.js';
const preference = 'last-folder-v1';
const port = {
    read: () => chrome.bookmarks.getTree(),
    create: (details: {
        parentId: string;
        title: string;
        url: string;
    }) => chrome.bookmarks.create(details),
    remember: async (id: string) => { await chrome.storage.local.set({ [preference]: id }); },
};
let queue: Promise<unknown> = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !sender.url || !['/app.html', '/library.html'].includes(new URL(sender.url).pathname))
        return false;
    const task = queue.then(async () => {
        if (message?.kind === 'read') {
            let lastFolderId: null | string = null;
            try {
                const stored = (await chrome.storage.local.get(preference))[preference];
                if (typeof stored === 'string')
                    lastFolderId = stored;
            }
            catch { /* Preference is optional. */ }
            return { tree: await port.read(), lastFolderId };
        }
        if (message?.kind === 'save')
            return saveBookmark(port, message.request as SaveRequest);
        throw Error('Unsupported request.');
    });
    queue = task.then(() => undefined, () => undefined);
    void task.then(value => respond({ ok: true, value }), error => respond({ ok: false, error: error instanceof Error ? error.message : 'The operation could not finish.' }));
    return true;
});
// Read a fresh tree only during a deliberate address-bar search. No background catalog.
let revision = 0;
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const current = ++revision;
    void port.read().then(tree => {
        if (current !== revision)
            return;
        const results = search(indexTree(tree), text).items.filter(bookmark => webAddress(bookmark.url)).slice(0, 5);
        suggest(results.map(bookmark => ({ content: `bookmark:${bookmark.id}`,
            description: `${escapeXML(bookmark.title || bookmark.url)} <dim>— ${escapeXML(bookmark.path)}</dim>` })));
    }).catch(() => { if (current === revision)
        suggest([]); });
});
chrome.omnibox.onInputCancelled.addListener(() => { revision++; });
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    revision++;
    void (async () => {
        let url = chrome.runtime.getURL(`library.html?q=${encodeURIComponent(text.slice(0, 200))}`);
        if (text.startsWith('bookmark:')) {
            const [bookmark] = await chrome.bookmarks.get(text.slice(9));
            if (!bookmark?.url || !webAddress(bookmark.url))
                return;
            url = bookmark.url;
        }
        if (disposition === 'currentTab')
            await chrome.tabs.update({ url });
        else
            await chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' });
    })().catch(() => { });
});
