import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['manifest.json', 'app.html', 'app.css'])
    await copyFile(file, `dist/${file}`);
await writeFile('dist/library.html', (await readFile('app.html', 'utf8')).replace('<html lang="en">', '<html lang="en" class="library">'));
await cp('icons', 'dist/icons', { recursive: true });
