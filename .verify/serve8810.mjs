import http from 'http'; import fs from 'fs'; import path from 'path';
const root = 'C:/Users/pmsma/Downloads/HST Digital Town Project/town';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.hdr': 'application/octet-stream', '.webp': 'image/webp', '.css': 'text/css' };
http.createServer((q, s) => {
  let fp = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (fp.endsWith(path.sep) || fp === root) fp = path.join(fp, 'index.html');
  fs.readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); s.end('nf'); }
    else { s.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); s.end(d); }
  });
}).listen(8810, () => console.log('up'));
