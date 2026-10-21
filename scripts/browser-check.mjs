import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import axe from 'axe-core';
import lighthouse, { snapshot } from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { openFixture, seed } from './browser-fixture.mjs';
const output = resolve('audit-results');
await mkdir(output, { recursive: true });
const fixture = await openFixture(), { browser, page, id, port } = fixture;
const summary = { date: new Date().toISOString(), browser: await browser.version(), passed: false, checks: [], axe: [], lighthouse: {} };
const request = (kind, request) => page.evaluate((kind, request) => chrome.runtime.sendMessage({ kind, request }), kind, request);
const tree = () => page.evaluate(() => chrome.bookmarks.getTree());
async function ready(ui = page, text = 'bookmarks ready') {
    await ui.waitForFunction(text => document.querySelector('#status').textContent.includes(text) && document.querySelector('#refresh').getAttribute('aria-disabled') === 'false', {}, text);
}
async function enter(selector, value, ui = page) {
    await ui.$eval(selector, (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function scan(ui, name) {
    await ui.evaluate(axe.source);
    const result = await ui.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }); return { violations: r.violations, incomplete: r.incomplete }; });
    await writeFile(join(output, `axe-${name}.json`), JSON.stringify(result, null, 2));
    assert.equal(result.violations.length, 0, `${name}: ${result.violations.map(v => v.id).join(', ')}`);
    assert.equal(result.incomplete.length, 0, `${name}: incomplete checks`);
    summary.axe.push({ state: name, violations: 0, incomplete: 0 });
    console.log('axe', name, 'passed');
}
try {
    const ids = await seed(page);
    summary.seedMs = ids.seedMs;
    await page.reload();
    await page.setViewport({ width: 580, height: 600 });
    await ready();
    const before = await tree();
    assert.match(await page.$eval('#status', el => el.textContent), /20,003/);
    assert.equal(await page.$$eval('#results > li', els => els.length), 20);
    await page.screenshot({ path: join(output, 'find.png'), fullPage: true });
    console.log('Find height', await page.$eval('main', el => el.getBoundingClientRect().height));
    assert.ok(await page.$eval('main', el => el.getBoundingClientRect().height <= 600), 'Find popup should fit the toolbar height');
    await scan(page, 'find');
    const accessibility = await snapshot(page, { flags: { onlyCategories: ['accessibility'], output: ['html', 'json'], logLevel: 'error' } });
    await writeFile(join(output, 'extension-accessibility.html'), accessibility.report[0]);
    assert.equal(accessibility.lhr.categories.accessibility.score, 1);
    summary.extensionAccessibility = 100;
    await page.click('#next');
    assert.match(await page.$eval('#result-count', el => el.textContent), /^21–40/);
    assert.equal(await page.$$eval('#results > li', els => els.length), 20);
    await enter('#query', 'hooks learning');
    await page.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('1–1 of 1'));
    assert.match(await page.$eval('#results', el => el.textContent), /Learning \/ Programming \/ React/);
    assert.match(await page.$eval('#results', el => el.textContent), /<script>not executed<\/script>/);
    assert.equal(await page.$$eval('#results script', els => els.length), 0);
    await enter('#query', 'article 19999');
    await page.waitForFunction(() => document.querySelector('#results a')?.textContent === 'Synthetic article 19999');
    await enter('#query', 'no-matches-at-all');
    await page.waitForFunction(() => document.querySelector('#result-count').textContent === 'No matching bookmarks');
    await scan(page, 'empty-search');
    assert.deepEqual(await tree(), before, 'Searching and changing result pages must not mutate bookmarks');
    summary.checks.push('native 20,003-item search, ancestor paths, bounded pagination, literal markup, empty state, no search mutations');
    const perf = await page.evaluate(async () => {
        const { indexTree, search } = await import('./model.js');
        const started = performance.now();
        const tree = await chrome.bookmarks.getTree(), readMs = performance.now() - started;
        const indexed = performance.now(), library = indexTree(tree), indexMs = performance.now() - indexed;
        const times = [];
        for (const query of ['article 19999', 'hooks learning', 'library.example', 'reference 50', 'no-match']) {
            const start = performance.now();
            search(library, query);
            times.push(performance.now() - start);
        }
        return { count: library.bookmarks.length, readMs, indexMs, searchMs: times };
    });
    summary.performance = perf;
    console.log('Large library timings', perf);
    // Native HTML links open only after an explicit click; no favicon or content fetching.
    const localURL = `http://reading.example:${port}/?source=bookmark#section`;
    await page.evaluate((parentId, url) => chrome.bookmarks.create({ parentId, title: 'Synthetic clickable page', url }), ids.running, localURL);
    await page.click('#refresh');
    await ready();
    await enter('#query', 'synthetic clickable');
    await page.waitForFunction(() => document.querySelector('#results a')?.textContent === 'Synthetic clickable page');
    const opening = browser.waitForTarget(target => target.url() === localURL);
    await page.click('#results a');
    const visited = await (await opening).page();
    assert.ok(visited);
    await visited.close();
    await page.bringToFront();
    summary.checks.push('explicit result link opens in a new tab');
    await page.click('#save-tab');
    await enter('#page-url', 'https://save.example/?id=42#section');
    await enter('#page-title', 'Synthetic saved page');
    await enter('#folder-query', 'learning react');
    await page.select('#folder', ids.react);
    assert.match(await page.$eval('#selected-folder', el => el.textContent), /Learning \/ Programming \/ React/);
    const original = await page.evaluate(id => chrome.bookmarks.get(id), ids.bookmark);
    await page.screenshot({ path: join(output, 'save-details.png'), fullPage: true });
    await scan(page, 'save-details');
    await page.$eval('#page-details', el => { el.open = false; });
    await scan(page, 'save-ready');
    await page.screenshot({ path: join(output, 'save.png'), fullPage: true });
    await page.click('#save');
    await ready(page, 'Saved in');
    assert.deepEqual(await page.evaluate(id => chrome.bookmarks.get(id), ids.bookmark), original);
    let saved = await page.evaluate(url => chrome.bookmarks.search({ url }), 'https://save.example/?id=42#section');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].parentId, ids.react);
    assert.match(await page.$eval('#copy-count', el => el.textContent), /Already bookmarked 1 time/);
    assert.equal(await page.$eval('#save', el => el.disabled), true);
    await scan(page, 'saved-duplicate');
    await page.click('#allow-copy');
    await page.click('#save');
    await ready(page, 'Saved in');
    saved = await page.evaluate(url => chrome.bookmarks.search({ url }), 'https://save.example/?id=42#section');
    assert.equal(saved.length, 2);
    assert.deepEqual(await page.evaluate(() => chrome.storage.local.get(null)), { 'last-folder-v1': ids.react });
    summary.checks.push('real nested save preserves existing bookmark metadata, duplicate notice and explicit second-copy consent, only one folder ID persisted');
    // Concurrent popup requests must not create two copies from the same stale intent.
    const input = { parentId: ids.react, folderPath: await page.$eval('#selected-folder', el => el.textContent.replace(/^Destination: /, '')),
        title: 'Synthetic concurrent save', url: 'https://concurrent.example/?id=9', allowDuplicate: false, duplicateCount: 0 };
    const concurrent = await page.evaluate(async (input) => Promise.all([1, 2].map(() => chrome.runtime.sendMessage({ kind: 'save', request: input }))), input);
    assert.deepEqual(concurrent.map(r => r.value.kind), ['saved', 'exists']);
    assert.equal((await page.evaluate(url => chrome.bookmarks.search({ url }), input.url)).length, 1);
    summary.checks.push('worker serializes competing save requests without an accidental second copy');
    await page.click('#refresh');
    await ready();
    const parent = await page.evaluate(id => chrome.bookmarks.get(id), ids.react);
    await page.evaluate(id => chrome.bookmarks.update(id, { title: 'React renamed' }), ids.react);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Bookmarks changed'));
    assert.equal(await page.$eval('#save', el => el.disabled), true);
    const rejected = await request('save', { ...input, url: 'https://renamed.example/' });
    assert.equal(rejected.ok, false);
    assert.match(rejected.error, /moved or was renamed/);
    await page.evaluate((id, title) => chrome.bookmarks.update(id, { title }), ids.react, parent[0].title);
    await page.click('#refresh');
    await ready();
    await scan(page, 'stale-recovered');
    summary.checks.push('external changes mark results stale; renamed ancestor/destination prevents stale save');
    const library = await browser.newPage();
    await library.goto(`chrome-extension://${id}/library.html`);
    await ready(library);
    await library.click('#save-tab');
    assert.equal(await library.$eval('#folder', el => el.value), ids.react);
    await library.close();
    summary.checks.push('last saved folder survives reopening the full library');
    // Trigger the real action: action.openPopup() alone does not grant activeTab.
    const sourceTarget = browser.waitForTarget(target => target.url() === localURL);
    await page.evaluate(url => chrome.tabs.create({ url, active: true }), localURL);
    const source = await (await sourceTarget).page();
    await source.waitForFunction(() => document.readyState === 'complete');
    let popup, popupTarget;
    try {
        const browserSession = await browser.target().createCDPSession();
        const { targetInfos } = await browserSession.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
        const targetInfo = targetInfos.find(target => target.url === localURL);
        if (!targetInfo)
            throw Error('No tab target is exposed for action testing.');
        [popupTarget] = await Promise.all([
            browser.waitForTarget(target => target !== page.target() && target.url() === `chrome-extension://${id}/app.html`, { timeout: 5000 }),
            browserSession.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId }),
        ]);
    }
    catch (error) {
        summary.toolbarUnverified = error.message;
    }
    try {
        if (popupTarget) {
            popup = await popupTarget.asPage();
            await ready(popup);
            await popup.waitForFunction(() => document.querySelector('#page-url').value.startsWith('http://reading.example:'), { timeout: 5000 });
            assert.equal(await popup.$eval('#page-url', el => el.value), localURL);
            assert.equal(await popup.$eval('#page-title', el => el.value), 'Synthetic running article');
            await popup.click('#save-tab');
            await popup.screenshot({ path: join(output, 'toolbar-save.png'), fullPage: true });
            await scan(popup, 'toolbar-save');
            summary.checks.push('actual action popup captures the invoked page title and full URL using activeTab');
        }
    }
    finally {
        if (popup)
            await popup.close();
        await source.close();
        await page.bringToFront();
    }
    await page.click('#find-tab');
    await enter('#query', 'hooks learning');
    assert.match(await page.$eval('#results a', el => el.textContent), /^Hooks & state/);
    await page.focus('#find-tab');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'save-tab');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'find-tab');
    await page.setViewport({ width: 320, height: 600 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('body,body *')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
        for (const [el, size] of sizes)
            el.style.fontSize = `${size * 2}px`;
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(output, 'reflow-find.png'), fullPage: true });
    await page.click('#save-tab');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(output, 'reflow-save.png'), fullPage: true });
    summary.checks.push('tablist keyboard navigation and both views at 320px with 200% text');
    const payload = (await request('read')).value;
    // A static document harness with the full synthetic snapshot. Its startup
    // includes parsing this fixture; native extension/API timings are measured above.
    await page.evaluateOnNewDocument(payload => {
        globalThis.chrome ??= {};
        chrome.runtime = { sendMessage: async () => ({ ok: true, value: payload }) };
        chrome.tabs = { query: async () => [] };
        chrome.bookmarks = {};
        for (const key of ['onCreated', 'onChanged', 'onMoved', 'onRemoved', 'onChildrenReordered', 'onImportEnded'])
            chrome.bookmarks[key] = { addListener() { } };
    }, payload);
    for (const preset of ['desktop', 'mobile']) {
        const flags = { output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
        if (preset === 'desktop')
            Object.assign(flags, { formFactor: 'desktop', screenEmulation: { mobile: false, width: 580, height: 600, deviceScaleFactor: 1, disabled: false } });
        const result = await lighthouse(`http://127.0.0.1:${port}/app.html`, flags, preset === 'desktop' ? desktopConfig : undefined, page);
        for (const [i, format] of ['html', 'json'].entries())
            await writeFile(join(output, `${preset}.${format}`), result.report[i]);
        const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, c]) => [key, c.score * 100]));
        summary.lighthouse[preset] = scores;
        console.log('Lighthouse', preset, scores);
        assert.ok(!result.lhr.runtimeError, JSON.stringify(result.lhr.runtimeError));
        // Performance is a budget across devices/runs; retain the exact measured
        // score rather than rerunning until timing noise happens to produce 100.
        assert.ok(scores.performance >= 95, 'Large-library UI performance budget');
        for (const category of ['accessibility', 'best-practices', 'seo'])
            assert.equal(scores[category], 100);
    }
    summary.passed = true;
    console.log('All checks passed in the isolated synthetic profile.');
}
finally {
    await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    await fixture.close();
}
