import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
export async function openFixture() {
    if (!process.env.BROWSER_PATH)
        throw new Error('Set BROWSER_PATH to a Chromium executable.');
    const assets = new Map([['/app.html', 'text/html'], ['/library.html', 'text/html'], ['/app.css', 'text/css'], ['/app.js', 'text/javascript'],
        ['/model.js', 'text/javascript'], ['/icons/icon.svg', 'image/svg+xml']]);
    const server = createServer(async (request, response) => {
        const url = new URL(request.url, 'http://fixture.example');
        if (url.pathname === '/favicon.ico') {
            response.writeHead(204);
            response.end();
            return;
        }
        if (assets.has(url.pathname)) {
            try {
                response.setHeader('Content-Type', assets.get(url.pathname));
                response.end(await readFile(join(resolve('dist'), url.pathname.slice(1))));
            }
            catch {
                response.writeHead(500);
                response.end('Missing build');
            }
            return;
        }
        if (url.pathname !== '/') {
            response.writeHead(404);
            response.end('Not found');
            return;
        }
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><html lang="en"><title>Synthetic running article</title><p>Public synthetic fixture.</p></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const profile = await mkdtemp(join(tmpdir(), 'busting-bookmarks-'));
    let browser;
    const close = async () => {
        if (browser)
            await browser.close();
        await new Promise(resolve => server.close(resolve));
        await rm(profile, { recursive: true, force: true });
    };
    try {
        const dir = resolve('dist');
        browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH, headless: true, userDataDir: profile,
            ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`,
                '--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP *.example 127.0.0.1', '--no-proxy-server'] });
        const page = await browser.newPage();
        await page.goto('chrome://extensions/');
        const id = await page.evaluate(() => [...document.querySelector('extensions-manager').shadowRoot
                .querySelector('extensions-item-list').shadowRoot.querySelectorAll('extensions-item')]
            .find(el => el.shadowRoot.querySelector('#name').textContent.includes('Busting Bookmarks'))?.id);
        if (!id)
            throw Error('Built extension did not load.');
        await page.goto(`chrome-extension://${id}/app.html`);
        return { browser, page, id, port, close };
    }
    catch (error) {
        await close();
        throw error;
    }
}
export async function seed(page, count = 20000) {
    return page.evaluate(async (count) => {
        const roots = await chrome.bookmarks.getTree();
        const bar = roots[0].children.find(n => n.folderType === 'bookmarks-bar') ?? roots[0].children.find(n => !n.unmodifiable);
        const library = await chrome.bookmarks.create({ parentId: bar.id, title: 'Synthetic Library' });
        const learning = await chrome.bookmarks.create({ parentId: library.id, title: 'Learning' });
        const programming = await chrome.bookmarks.create({ parentId: learning.id, title: 'Programming' });
        const react = await chrome.bookmarks.create({ parentId: programming.id, title: 'React' });
        const running = await chrome.bookmarks.create({ parentId: library.id, title: 'Running' });
        const bookmark = await chrome.bookmarks.create({ parentId: react.id, title: 'Hooks & state <script>not executed</script>', url: 'https://docs.example/react/hooks?lang=en#intro' });
        await chrome.bookmarks.create({ parentId: running.id, title: 'Canal loop', url: 'https://routes.example/canal' });
        await chrome.bookmarks.create({ parentId: running.id, title: 'Local bookmarklet', url: 'javascript:alert(1)' });
        const started = performance.now();
        for (let start = 0; start < count; start += 200) {
            const folder = await chrome.bookmarks.create({ parentId: library.id, title: `Reference ${start / 200}` });
            await Promise.all(Array.from({ length: Math.min(200, count - start) }, (_, i) => chrome.bookmarks.create({ parentId: folder.id,
                title: `Synthetic article ${start + i}`, url: `https://library.example/items/${start + i}` })));
        }
        return { library: library.id, react: react.id, running: running.id, bookmark: bookmark.id, seedMs: performance.now() - started };
    }, count);
}
