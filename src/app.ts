import { existingCopies, findFolders, indexTree, search, webAddress, type Folder, type Library, type Node, type Sort } from './model.js';
import type { SaveRequest, SaveResult } from './save.js';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const query = get<HTMLInputElement>('query'), sort = get<HTMLSelectElement>('sort');
const address = get<HTMLTextAreaElement>('page-url'), title = get<HTMLInputElement>('page-title');
const folderQuery = get<HTMLInputElement>('folder-query'), folders = get<HTMLSelectElement>('folder');
const allowCopy = get<HTMLInputElement>('allow-copy'), status = get('status'), error = get('error');
const fullPage = document.documentElement.classList.contains('library');
const size = 20;
const savedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
let library: Library = { bookmarks: [], folders: [] }, selected: Folder | null = null;
let loaded = false, busy = false, stale = false, saved = false, offset = 0;
async function request<T>(kind: string, request?: SaveRequest): Promise<T> {
    const response = await chrome.runtime.sendMessage({ kind, request });
    if (!response?.ok)
        throw Error(response?.error ?? 'The extension worker is unavailable. Reload the extension.');
    return response.value as T;
}
function availability() {
    get('refresh').setAttribute('aria-disabled', String(busy));
    get<HTMLButtonElement>('save').disabled = busy || !loaded || stale || saved || !selected || !webAddress(address.value.trim()) || !title.value.trim() ||
        (existingCopies(library, address.value.trim()).length > 0 && !allowCopy.checked);
    for (const element of [address, title, folderQuery, folders, allowCopy, get<HTMLButtonElement>('use-page')])
        element.disabled = busy;
}
function showResults(focus = false) {
    const result = search(library, query.value, sort.value as Sort, offset, size);
    if (offset >= result.total && offset > 0) {
        offset = 0;
        showResults(focus);
        return;
    }
    const rows = result.items.map(bookmark => {
        const item = document.createElement('li');
        const heading = document.createElement(webAddress(bookmark.url) ? 'a' : 'span');
        heading.className = 'result-title';
        heading.textContent = bookmark.title || bookmark.url;
        if (heading instanceof HTMLAnchorElement) {
            heading.href = bookmark.url;
            heading.target = '_blank';
            heading.rel = 'noopener noreferrer';
        }
        const path = document.createElement('span');
        path.className = 'result-path';
        path.textContent = bookmark.path;
        const url = document.createElement('span');
        url.className = 'result-url';
        url.textContent = bookmark.url;
        item.append(heading, path, url);
        if (bookmark.dateAdded !== undefined && Number.isFinite(new Date(bookmark.dateAdded).getTime())) {
            const date = document.createElement('span');
            date.className = 'result-date';
            date.textContent = `Saved ${savedDate.format(bookmark.dateAdded)}`;
            item.append(date);
        }
        if (!webAddress(bookmark.url)) {
            const note = document.createElement('span');
            note.className = 'result-date';
            note.textContent = 'Non-web bookmark · searchable, but cannot be opened here.';
            item.append(note);
        }
        return item;
    });
    if (!rows.length) {
        const empty = document.createElement('li');
        empty.textContent = library.bookmarks.length ? 'No matches. Try fewer words or a different folder name.' : 'No bookmarks yet. Save a page to get started.';
        rows.push(empty);
    }
    get('results').replaceChildren(...rows);
    get('result-count').textContent = result.total ? `${offset + 1}–${Math.min(offset + size, result.total)} of ${result.total.toLocaleString()} bookmarks` : 'No matching bookmarks';
    get<HTMLButtonElement>('previous').disabled = offset === 0;
    get<HTMLButtonElement>('next').disabled = offset + size >= result.total;
    get('results-region').scrollTop = 0;
    if (focus)
        get('results-region').focus();
}
function showCopies() {
    const source = webAddress(address.value.trim());
    get('source-caption').textContent = source ? ` · ${new URL(source).hostname}` : '';
    const copies = existingCopies(library, address.value.trim());
    get('copies').hidden = copies.length === 0;
    get('copy-count').textContent = `Already bookmarked ${copies.length} ${copies.length === 1 ? 'time' : 'times'}. Existing copies stay in place.`;
    const paths = copies.slice(0, 5).map(copy => { const item = document.createElement('li'); item.textContent = copy.path; return item; });
    if (copies.length > 5) {
        const item = document.createElement('li');
        item.textContent = `And ${copies.length - 5} more.`;
        paths.push(item);
    }
    get('copy-paths').replaceChildren(...paths);
    availability();
}
function showFolders() {
    const matches = findFolders(library, folderQuery.value);
    const shown = matches.slice(0, 50);
    if (selected && !shown.some(folder => folder.id === selected!.id) && !folderQuery.value)
        shown.unshift(selected);
    const empty = new Option('Choose a folder…', '');
    empty.disabled = true;
    folders.replaceChildren(empty, ...shown.map(folder => new Option(folder.path, folder.id)));
    folders.value = selected?.id ?? '';
    get('folder-count').textContent = `${matches.length.toLocaleString()} writable ${matches.length === 1 ? 'folder' : 'folders'}${matches.length > 50 ? ' · first 50 shown; type more to narrow' : ''}`;
    get('selected-folder').textContent = selected ? `Destination: ${selected.path}` : 'Choose a folder above.';
    availability();
}
async function read() {
    const value = await request<{
        tree: Node[];
        lastFolderId: string | null;
    }>('read');
    library = indexTree(value.tree);
    loaded = true;
    stale = false;
    selected = library.folders.find(folder => folder.writable && folder.id === (selected?.id ?? value.lastFolderId)) ?? null;
    if (selected && folderQuery.value && !findFolders(library, folderQuery.value).some(folder => folder.id === selected!.id))
        selected = null;
    showResults();
    showFolders();
    showCopies();
}
async function refresh() {
    if (busy)
        return;
    busy = true;
    availability();
    error.textContent = '';
    status.textContent = 'Reading bookmarks…';
    try {
        await read();
        status.textContent = `${library.bookmarks.length.toLocaleString()} bookmarks ready. Search or save a page.`;
    }
    catch (e) {
        stale = true;
        error.textContent = e instanceof Error ? e.message : 'The library could not be read.';
        status.textContent = '';
    }
    finally {
        busy = false;
        availability();
    }
}
async function usePage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && webAddress(tab.url)) {
        address.value = tab.url;
        title.value = tab.title || tab.url;
        saved = false;
        allowCopy.checked = false;
        showCopies();
        get<HTMLDetailsElement>('page-details').open = false;
        return true;
    }
    return false;
}
async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy || get<HTMLButtonElement>('save').disabled || !selected)
        return;
    const input: SaveRequest = { parentId: selected.id, folderPath: selected.path, title: title.value, url: address.value,
        allowDuplicate: allowCopy.checked, duplicateCount: existingCopies(library, address.value.trim()).length };
    busy = true;
    availability();
    error.textContent = '';
    status.textContent = 'Saving into your browser bookmarks…';
    let result: SaveResult | null = null;
    try {
        result = await request<SaveResult>('save', input);
        allowCopy.checked = false;
        if (result.kind === 'saved') {
            saved = true;
            status.textContent = result.warning ?? `Saved in ${input.folderPath}.`;
        }
        else
            status.textContent = 'This address is already bookmarked. Review the copies below before saving another.';
        await read();
    }
    catch (e) {
        allowCopy.checked = false;
        if (result?.kind === 'saved') {
            status.textContent = `Saved in ${input.folderPath}. Refresh to update the displayed library.`;
            stale = true;
        }
        else {
            error.textContent = e instanceof Error ? e.message : 'The save could not be confirmed. Refresh before trying again.';
            status.textContent = '';
            stale = true;
            try {
                await read();
            }
            catch { /* Keep the error and require Refresh. */ }
        }
    }
    finally {
        busy = false;
        availability();
    }
}
function selectPanel(name: 'find' | 'save', focus = true) {
    for (const panel of ['find', 'save']) {
        const active = panel === name, tab = get<HTMLButtonElement>(`${panel}-tab`);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        get(`${panel}-panel`).hidden = !active;
    }
    if (focus)
        (name === 'find' ? query : address).focus();
}
get('find-tab').addEventListener('click', () => selectPanel('find'));
get('save-tab').addEventListener('click', () => selectPanel('save'));
get('find-tab').parentElement!.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        return;
    event.preventDefault();
    const name = event.key === 'Home' ? 'find' : event.key === 'End' ? 'save' : get('find-tab').getAttribute('aria-selected') === 'true' ? 'save' : 'find';
    selectPanel(name, false);
    get(`${name}-tab`).focus();
});
query.addEventListener('input', () => { offset = 0; showResults(); });
sort.addEventListener('change', () => { offset = 0; showResults(); });
get('previous').addEventListener('click', () => { offset = Math.max(0, offset - size); showResults(true); });
get('next').addEventListener('click', () => { offset += size; showResults(true); });
get('refresh').addEventListener('click', () => void refresh());
folderQuery.addEventListener('input', () => { selected = null; saved = false; showFolders(); });
folderQuery.addEventListener('keydown', event => { if (event.key === 'Enter') {
    event.preventDefault();
    folders.focus();
} });
folders.addEventListener('change', () => {
    selected = library.folders.find(folder => folder.id === folders.value && folder.writable) ?? null;
    saved = false;
    get('selected-folder').textContent = selected ? `Destination: ${selected.path}` : 'Choose a folder above.';
    availability();
});
address.addEventListener('input', () => { saved = false; allowCopy.checked = false; showCopies(); });
title.addEventListener('input', () => { saved = false; availability(); });
allowCopy.addEventListener('change', () => { saved = false; availability(); });
get('save-form').addEventListener('submit', event => void save(event as SubmitEvent));
get('use-page').addEventListener('click', () => {
    void usePage().then(found => { status.textContent = found ? 'Current page ready. Choose a folder, then Save.' : 'Open this popup on a web page, or paste an address above.'; if (found)
        folderQuery.focus(); })
        .catch(() => { error.textContent = 'The current page could not be read. You can paste its address instead.'; });
});
get<HTMLAnchorElement>('library-link').addEventListener('click', () => {
    get<HTMLAnchorElement>('library-link').href = chrome.runtime.getURL(`library.html?q=${encodeURIComponent(query.value)}`);
});
function changed() {
    if (busy || !loaded)
        return;
    stale = true;
    availability();
    status.textContent = 'Bookmarks changed. Refresh to update results and destinations.';
}
for (const event of [chrome.bookmarks.onCreated, chrome.bookmarks.onChanged, chrome.bookmarks.onMoved,
    chrome.bookmarks.onRemoved, chrome.bookmarks.onChildrenReordered, chrome.bookmarks.onImportEnded])
    event.addListener(changed);
query.value = new URL(location.href).searchParams.get('q')?.slice(0, 200) ?? '';
void (async () => { await refresh(); if (!fullPage)
    await usePage().catch(() => false); query.focus(); })();
