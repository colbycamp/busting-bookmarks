import { existingCopies, indexTree, webAddress, type Bookmark, type Node } from './model.js';
export interface SaveRequest {
    parentId: string;
    folderPath: string;
    title: string;
    url: string;
    allowDuplicate: boolean;
    duplicateCount: number;
}
export interface Port {
    read(): Promise<Node[]>;
    create(details: {
        parentId: string;
        title: string;
        url: string;
    }): Promise<Node>;
    remember(folderId: string): Promise<void>;
}
export type SaveResult = {
    kind: 'exists';
    copies: Bookmark[];
} | {
    kind: 'saved';
    bookmark: Node;
    warning: string | null;
};
export async function saveBookmark(port: Port, request: SaveRequest): Promise<SaveResult> {
    if (!request || typeof request.title !== 'string' || typeof request.url !== 'string' || typeof request.parentId !== 'string' ||
        typeof request.folderPath !== 'string' || typeof request.allowDuplicate !== 'boolean' || !Number.isInteger(request.duplicateCount) || request.duplicateCount < 0)
        throw Error('The save request is incomplete.');
    const title = request.title.trim(), url = request.url.trim();
    if (!title || title.length > 4096)
        throw Error('Enter a title between 1 and 4,096 characters.');
    if (url.length > 16384 || !webAddress(url))
        throw Error('Enter a complete HTTP or HTTPS web address.');
    const library = indexTree(await port.read());
    const folder = library.folders.find(folder => folder.id === request.parentId);
    if (!folder?.writable)
        throw Error('That folder is unavailable or read-only. Choose another folder.');
    if (folder.path !== request.folderPath)
        throw Error('That folder moved or was renamed. Refresh and choose it again.');
    const copies = existingCopies(library, url);
    if (copies.length && (!request.allowDuplicate || copies.length !== request.duplicateCount))
        return { kind: 'exists', copies };
    const bookmark = await port.create({ parentId: folder.id, title, url });
    // A preference write failure must not turn a successful native save into a reported failure.
    let warning: string | null = null;
    try {
        await port.remember(folder.id);
    }
    catch {
        warning = 'Saved, but the last-folder preference could not be remembered.';
    }
    return { kind: 'saved', bookmark, warning };
}
