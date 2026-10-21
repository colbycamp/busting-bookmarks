import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { indexTree, search, findFolders, existingCopies, webAddress, escapeXML } from '../dist/model.js';
const link = (id, title, url, extra = {}) => ({ id, title, url, parentId: 'react', ...extra });
const tree = () => [{ id: 'root', title: '', children: [{ id: 'bar', parentId: 'root', title: 'Bookmarks bar', folderType: 'bookmarks-bar', children: [
                    { id: 'learn', parentId: 'bar', title: 'Learning', children: [{ id: 'react', parentId: 'learn', title: 'React', children: [
                                    link('a', 'Café patterns', 'https://docs.example/hello%20world?lang=en#intro', { dateAdded: 100, dateLastUsed: 200 }),
                                    link('b', 'Hooks 10', 'https://docs.example/hooks/10', { dateAdded: 300 }),
                                    link('c', 'Hooks 2', 'https://docs.example/hooks/2', { dateAdded: 200 }),
                                ] }] },
                    { id: 'empty', parentId: 'bar', title: 'Empty' },
                    { id: 'admin', parentId: 'bar', title: 'Managed', unmodifiable: 'managed', children: [{ id: 'locked', parentId: 'admin', title: 'Child' }] },
                ] }] }];
test('index preserves native inputs, complete ancestry, empty folders and metadata', () => {
    const original = tree(), copy = structuredClone(original), library = indexTree(original);
    assert.deepEqual(original, copy);
    assert.equal(library.bookmarks[0].path, 'Bookmarks bar / Learning / React');
    assert.equal(library.bookmarks[0].dateAdded, 100);
    assert.equal(library.bookmarks[0].dateLastUsed, 200);
    assert.ok(library.folders.find(f => f.id === 'bar').writable, 'Browser-provided parents accept child saves');
    assert.ok(library.folders.find(f => f.id === 'empty').writable);
    assert.equal(library.folders.find(f => f.id === 'locked').writable, false);
    assert.ok(!library.folders.some(f => f.id === 'root'));
    assert.throws(() => indexTree([...original, ...original]), /repeated IDs/);
});
test('search combines words across title, URL and ancestor folders, ignoring case/accents', () => {
    const library = indexTree(tree());
    for (const query of ['CAFÉ', 'cafe learning', 'patterns docs.example react', 'hello world', 'en#intro'])
        assert.deepEqual(search(library, query).items.map(b => b.id), ['a']);
    assert.equal(search(library, 'patterns unknown').total, 0);
    assert.equal(search(library, '<script>').total, 0);
});
test('ordering uses relevance, native saved dates and natural titles without dropping ties', () => {
    const library = indexTree(tree());
    assert.deepEqual(search(library, '').items.map(b => b.id), ['b', 'c', 'a']);
    assert.deepEqual(search(library, '', 'title').items.map(b => b.id), ['a', 'c', 'b']);
    assert.equal(search(library, 'hooks 2').items[0].id, 'c');
    library.bookmarks.push({ ...library.bookmarks[2], id: 'same' });
    assert.deepEqual(search(library, 'hooks 2').items.map(b => b.id), ['c', 'same']);
    assert.throws(() => search(library, '', 'invalid'), /Unsupported/);
});
test('folder search uses full paths, supports empty folders and omits managed destinations', () => {
    const library = indexTree(tree());
    assert.deepEqual(findFolders(library, 'learning react').map(f => f.id), ['react']);
    assert.deepEqual(findFolders(library, 'empty').map(f => f.id), ['empty']);
    assert.deepEqual(findFolders(library, 'managed'), []);
});
test('address matching uses browser URL normalization, preserving functional queries/fragments', () => {
    const library = indexTree(tree());
    assert.equal(existingCopies(library, 'https://DOCS.example/hello%20world?lang=en#intro').length, 1);
    assert.equal(existingCopies(library, 'https://docs.example/hello%20world?lang=fr#intro').length, 0);
    assert.equal(existingCopies(library, 'https://docs.example/hello%20world?lang=en#other').length, 0);
    assert.equal(webAddress('javascript:alert(1)'), null);
    assert.equal(webAddress('file:///tmp/x'), null);
    assert.equal(webAddress('not a URL'), null);
    assert.equal(webAddress('https://example.com'), 'https://example.com/');
});
test('large and deeply nested collections have bounded result pages', () => {
    const links = Array.from({ length: 20000 }, (_, i) => link(String(i), `Item ${i}`, `https://library.example/items/${i}`, { dateAdded: i }));
    const start = performance.now();
    const library = indexTree([{ id: 'root', title: '', children: [{ id: 'react', parentId: 'root', title: 'Reference', children: links }] }]);
    const page = search(library, 'reference', 'newest', 20, 20);
    assert.equal(page.total, 20000);
    assert.equal(page.items.length, 20);
    assert.equal(page.items[0].id, '19979');
    assert.equal(search(library, 'items/19999').items[0].id, '19999');
    console.log(`Synthetic 20,000-bookmark index plus two searches: ${(performance.now() - start).toFixed(1)} ms`);
    let node = { id: '1001', parentId: '1000', title: 'Leaf', url: 'https://deep.example/' };
    for (let i = 1000; i >= 0; i--)
        node = { id: String(i), ...(i ? { parentId: String(i - 1) } : {}), title: `Folder ${i}`, children: [node] };
    assert.equal(indexTree([node]).bookmarks.length, 1);
});
test('omnibox text is escaped as data, including markup-like titles', () => {
    assert.equal(escapeXML('<script a="x">&\'safe\'</script>'), '&lt;script a=&quot;x&quot;&gt;&amp;&apos;safe&apos;&lt;/script&gt;');
});
