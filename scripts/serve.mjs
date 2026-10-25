import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { build, projectRoot } from './build.mjs';

const watching = process.argv.includes('--watch');
const section = process.argv.includes('--wikis') ? 'wikis' : process.env.SITE_SECTION;
const { output, base } = await build({ section });
const port = Number(process.env.PORT || 4321);
const host = process.env.HOST || '127.0.0.1';
const clients = new Set();
let buildError = '';
let revision = randomUUID();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.markdown': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const reload = () => `<script>const revision = ${JSON.stringify(revision)};const events = new EventSource('${base}/__reload');events.onmessage = (event) => { if (event.data !== revision) location.reload(); };</script>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (watching && url.pathname === `${base}/__reload`) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(`data: ${revision}\n\n`);
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (base && pathname === base) {
      response.writeHead(301, { Location: `${base}/${url.search}` }); response.end(); return;
    }
    if (base && !pathname.startsWith(`${base}/`)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    let target = path.resolve(output, `.${pathname.slice(base.length)}`);
    if (target !== output && !target.startsWith(`${output}${path.sep}`)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let status = 200;
    try {
      const info = await stat(target);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(301, { Location: `${url.pathname}/${url.search}` }); response.end(); return;
        }
        target = path.join(target, 'index.html');
        await stat(target);
      }
    } catch {
      status = 404;
      target = path.join(output, '404.html');
    }
    if (buildError && watching) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Build failed: ${buildError}\n\nFix the file and save to rebuild.`); return;
    }
    let body = await readFile(target);
    if (watching && path.extname(target) === '.html') body = body.toString().replace('</body>', `${reload()}</body>`);
    response.writeHead(status, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 500);
    response.end(error instanceof URIError ? 'Malformed URL' : 'Unable to serve this page');
  }
});

server.listen(port, host, () => console.log(`Local: http://${host}:${port}${base}/ ${watching ? '(live reload enabled)' : '(production preview)'}`));
server.on('error', (error) => { console.error(error.message); process.exit(1); });

if (watching) {
  let timer;
  let building = false;
  let pending = false;
  async function rebuild() {
    if (building) { pending = true; return; }
    building = true;
    try { await build({ section }); buildError = ''; }
    catch (error) { buildError = error.message; console.error(`Build failed: ${buildError}`); }
    finally {
      building = false;
      revision = randomUUID();
      for (const client of clients) client.write(`data: ${revision}\n\n`);
      if (pending) { pending = false; await rebuild(); }
    }
  }
  const folders = ['articles', 'public'];
  for (const folder of folders) watch(path.join(projectRoot, folder), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 120); });
  watch(projectRoot, (_, filename) => {
    if (['site.config.json', '.article-dates.json'].includes(String(filename))) {
      clearTimeout(timer); timer = setTimeout(rebuild, 120);
    }
  });
}
