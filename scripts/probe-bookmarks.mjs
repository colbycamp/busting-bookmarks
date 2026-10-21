import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openFixture, seed } from './browser-fixture.mjs';
const fixture = await openFixture();
try {
    const ids = await seed(fixture.page);
    const result = await fixture.page.evaluate(async (ids) => {
        const start = performance.now(), tree = await chrome.bookmarks.getTree();
        const getTreeMs = performance.now() - start;
        const before = (await chrome.bookmarks.get(ids.bookmark))[0];
        const created = await chrome.bookmarks.create({ parentId: ids.react, title: 'Synthetic saved page', url: 'https://save.example/?id=42#section' });
        const after = (await chrome.bookmarks.get(ids.bookmark))[0];
        const stored = (await chrome.bookmarks.get(created.id))[0];
        return { getTreeMs, before, after, stored, rootCount: tree[0].children.length };
    }, ids);
    assert.deepEqual(result.before, result.after, 'Saving must leave existing metadata intact');
    assert.equal(result.stored.parentId, ids.react);
    assert.equal(result.stored.url, 'https://save.example/?id=42#section');
    await mkdir('audit-results', { recursive: true });
    await writeFile('audit-results/probe.json', JSON.stringify({ browser: await fixture.browser.version(), ...ids, ...result }, null, 2));
    console.log(JSON.stringify({ seedMs: ids.seedMs, getTreeMs: result.getTreeMs, existingMetadataUnchanged: true, nestedSavePassed: true }));
}
finally {
    await fixture.close();
}
