import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveBookmark } from '../dist/save.js';
function fixture() {
    const tree = [{ id: '0', title: '', children: [{ id: '1', parentId: '0', title: 'Bar', children: [
                        { id: '2', parentId: '1', title: 'Reading', children: [{ id: '3', parentId: '2', title: 'Existing', url: 'https://existing.example/?id=2#part', dateAdded: 123, index: 0 }] },
                        { id: '4', parentId: '1', title: 'Managed', unmodifiable: 'managed', children: [] },
                    ] }] }];
    const f = { tree, creates: 0, remembers: 0, failCreate: false, failRemember: false };
    f.port = { read: async () => structuredClone(f.tree), create: async (details) => {
            if (f.failCreate)
                throw Error('Native create failed');
            f.creates++;
            const bookmark = { ...details, id: `new-${f.creates}`, dateAdded: 456 };
            f.tree[0].children[0].children[0].children.push(bookmark);
            return bookmark;
        }, remember: async () => { f.remembers++; if (f.failRemember)
            throw Error('Preference failed'); } };
    f.input = { parentId: '2', folderPath: 'Bar / Reading', title: 'New page', url: 'https://new.example/?id=42#section', allowDuplicate: false, duplicateCount: 0 };
    return f;
}
test('save creates one native bookmark without changing prior content, order or dates', async () => {
    const f = fixture(), before = structuredClone(f.tree[0].children[0].children[0].children);
    const result = await saveBookmark(f.port, f.input);
    assert.equal(result.kind, 'saved');
    assert.equal(result.bookmark.parentId, '2');
    assert.equal(result.bookmark.url, f.input.url);
    assert.deepEqual(f.tree[0].children[0].children[0].children.slice(0, -1), before);
    assert.equal(f.creates, 1);
    assert.equal(f.remembers, 1);
});
test('bad title/address/request is rejected before mutation', async () => {
    for (const changes of [{ title: '' }, { title: 'x'.repeat(4097) }, { url: 'javascript:alert(1)' }, { url: 'file:///tmp/x' }, { url: 'bad' }, { url: 5 }, { duplicateCount: -1 }, { allowDuplicate: undefined }]) {
        const f = fixture();
        await assert.rejects(saveBookmark(f.port, { ...f.input, ...changes }));
        assert.equal(f.creates, 0);
    }
});
test('root, managed, missing, renamed and moved destinations cannot silently receive a save', async () => {
    for (const changes of [{ parentId: '0' }, { parentId: '4' }, { parentId: 'missing' }, { folderPath: 'Bar / Old name' }]) {
        const f = fixture();
        await assert.rejects(saveBookmark(f.port, { ...f.input, ...changes }), /folder/i);
        assert.equal(f.creates, 0);
    }
    const f = fixture();
    f.tree[0].children[0].title = 'Renamed ancestor';
    await assert.rejects(saveBookmark(f.port, f.input), /moved or was renamed/);
    assert.equal(f.creates, 0);
});
test('existing addresses are reported; another copy needs explicit acknowledgement of the current count', async () => {
    const f = fixture();
    f.input.url = 'https://existing.example/?id=2#part';
    assert.equal((await saveBookmark(f.port, f.input)).kind, 'exists');
    assert.equal(f.creates, 0);
    assert.equal((await saveBookmark(f.port, { ...f.input, allowDuplicate: true, duplicateCount: 0 })).kind, 'exists');
    assert.equal(f.creates, 0);
    assert.equal((await saveBookmark(f.port, { ...f.input, allowDuplicate: true, duplicateCount: 1 })).kind, 'saved');
    assert.equal(f.creates, 1);
    assert.equal((await saveBookmark(f.port, { ...f.input, allowDuplicate: true, duplicateCount: 1 })).kind, 'exists');
    assert.equal(f.creates, 1);
});
test('native create errors are not reported as success, and preferences never block a confirmed save', async () => {
    const f = fixture();
    f.failCreate = true;
    await assert.rejects(saveBookmark(f.port, f.input), /Native create/);
    assert.equal(f.remembers, 0);
    f.failCreate = false;
    f.failRemember = true;
    const result = await saveBookmark(f.port, f.input);
    assert.equal(result.kind, 'saved');
    assert.match(result.warning, /Saved, but/);
    assert.equal(f.creates, 1);
});
