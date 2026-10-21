import { readFile, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
if (!process.env.BROWSER_PATH)
    throw new Error('Set BROWSER_PATH to a Chromium browser executable.');
const svg = await readFile('icons/icon.svg');
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
try {
    const page = await browser.newPage();
    for (const size of [16, 24, 32, 48, 128]) {
        const data = await page.evaluate(async (source, size) => {
            const img = new Image();
            img.src = 'data:image/svg+xml;base64,' + source;
            await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            canvas.getContext('2d').drawImage(img, 0, 0, size, size);
            return canvas.toDataURL('image/png').split(',')[1];
        }, svg.toString('base64'), size);
        await writeFile(`icons/icon${size}.png`, Buffer.from(data, 'base64'));
    }
}
finally {
    await browser.close();
}
