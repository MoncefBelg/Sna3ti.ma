/* Sync the current web app into www/ (Capacitor's webDir).
   Run after editing index-v3.html / js / css / assets, before `cap sync`. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname + '/..';
const WWW = ROOT + '/www';

function rmDir(d) { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); }
function cp(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
function cpDir(src, dst) {
  if (!fs.existsSync(src)) { console.warn('skip missing dir: ' + src); return; }
  rmDir(dst);
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach((e) => {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) cpDir(s, d); else cp(s, d);
  });
}

rmDir(WWW);
fs.mkdirSync(WWW, { recursive: true });

// index.html is the Capacitor entry point (index-v3.html is the dev filename)
cp(ROOT + '/index-v3.html', WWW + '/index.html');
cp(ROOT + '/manifest.json', WWW + '/manifest.json');
cp(ROOT + '/service-worker.js', WWW + '/service-worker.js');
cp(ROOT + '/robots.txt', WWW + '/robots.txt');
cp(ROOT + '/hero.webp', WWW + '/hero.webp');
cpDir(ROOT + '/assets', WWW + '/assets');
cpDir(ROOT + '/js', WWW + '/js');
cpDir(ROOT + '/css', WWW + '/css');

console.log('✓ www/ synced from web app');
