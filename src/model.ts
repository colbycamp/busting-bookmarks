export interface Node {
    id: string;
    parentId?: string;
    title: string;
    url?: string;
    children?: Node[];
    dateAdded?: number;
    dateGroupModified?: number;
    dateLastUsed?: number;
    unmodifiable?: string;
    folderType?: string;
    syncing?: boolean;
}
export interface Bookmark {
    id: string;
    title: string;
    url: string;
    path: string;
    parentId: string;
    dateAdded?: number;
    dateLastUsed?: number;
    titleKey: string;
    urlKey: string;
    pathKey: string;
    addressKey: string | null;
}
export interface Folder {
    id: string;
    title: string;
    path: string;
    key: string;
    writable: boolean;
    dateGroupModified?: number;
}
export interface Library {
    bookmarks: Bookmark[];
    folders: Folder[];
}
export type Sort = 'relevance' | 'newest' | 'title';
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const terms = (query: string) => normalize(query.slice(0, 200)).trim().split(/\s+/u).filter(Boolean);
export function webAddress(value: string): string | null {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    }
    catch {
        return null;
    }
}
function readableURL(url: string): string {
    try {
        return `${url} ${decodeURI(url)}`;
    }
    catch {
        return url;
    }
}
export function indexTree(tree: Node[]): Library {
    const library: Library = { bookmarks: [], folders: [] };
    const stack = tree.slice().reverse().map(node => ({ node, path: [] as string[], managed: false }));
    const seen = new Set<string>();
    while (stack.length) {
        const { node, path, managed } = stack.pop()!;
        if (seen.has(node.id))
            throw Error('Bookmark tree contains repeated IDs. Refresh the library.');
        seen.add(node.id);
        if (node.url !== undefined) {
            const folderPath = path.join(' / ');
            library.bookmarks.push({ id: node.id, parentId: node.parentId ?? '', title: node.title, url: node.url, path: folderPath,
                dateAdded: node.dateAdded, dateLastUsed: node.dateLastUsed,
                titleKey: normalize(node.title), urlKey: normalize(readableURL(node.url)), pathKey: normalize(folderPath), addressKey: webAddress(node.url) });
            continue;
        }
        const root = node.parentId === undefined;
        const nextPath = root ? path : [...path, node.title || '(Untitled folder)'];
        const readonly = managed || Boolean(node.unmodifiable) || node.folderType === 'managed';
        if (!root)
            library.folders.push({ id: node.id, title: node.title, path: nextPath.join(' / '), key: normalize(nextPath.join(' / ')),
                writable: !readonly, dateGroupModified: node.dateGroupModified });
        for (const child of (node.children ?? []).slice().reverse())
            stack.push({ node: child, path: nextPath, managed: readonly });
    }
    return library;
}
export function search(library: Library, query: string, sort: Sort = 'relevance', offset = 0, limit = 20) {
    if (!['relevance', 'newest', 'title'].includes(sort))
        throw Error('Unsupported sort order.');
    const words = terms(query), phrase = normalize(query.slice(0, 200)).trim();
    const matches = library.bookmarks.flatMap(bookmark => {
        if (!words.every(word => bookmark.titleKey.includes(word) || bookmark.urlKey.includes(word) || bookmark.pathKey.includes(word)))
            return [];
        const score = words.length ? (bookmark.titleKey === phrase ? 100 : bookmark.titleKey.startsWith(phrase) ? 40 : 0) +
            words.reduce((sum, word) => sum + (bookmark.titleKey.includes(word) ? 8 : 0) + (bookmark.urlKey.includes(word) ? 4 : 0) + (bookmark.pathKey.includes(word) ? 2 : 0), 0) : 0;
        return [{ bookmark, score }];
    });
    matches.sort((a, b) => {
        if (sort === 'title')
            return collator.compare(a.bookmark.title, b.bookmark.title);
        return (sort === 'relevance' ? b.score - a.score : 0) || (b.bookmark.dateAdded ?? 0) - (a.bookmark.dateAdded ?? 0);
    });
    return { total: matches.length, items: matches.slice(offset, offset + limit).map(match => match.bookmark) };
}
export function findFolders(library: Library, query: string) {
    const words = terms(query);
    return library.folders.filter(folder => folder.writable && words.every(word => folder.key.includes(word)))
        .sort((a, b) => collator.compare(a.path, b.path));
}
export function existingCopies(library: Library, url: string) {
    const address = webAddress(url);
    return address ? library.bookmarks.filter(bookmark => bookmark.addressKey === address) : [];
}
export function escapeXML(value: string): string {
    return value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]!));
}
