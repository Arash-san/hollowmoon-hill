// Bundle the browser pages into dist/ (or --out=<dir>). --dev keeps names readable with source maps; --watch rebuilds.
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const watch = args.has('--watch');
const dev = args.has('--dev') || watch;
const outArg = process.argv.find((a) => a.startsWith('--out='));
const dist = path.resolve(root, outArg ? outArg.slice(6) : 'dist');
const PAGES = { index: 'main', booth: 'booth', admin: 'admin', gallery: 'gallery', gm: 'gm', speaker: 'speaker' };

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    if (f.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function writePages(meta) {
  const out = {};
  for (const [file, info] of Object.entries(meta.outputs)) {
    if (!info.entryPoint) continue;
    out[path.basename(info.entryPoint, '.js')] = { js: path.basename(file), css: info.cssBundle ? path.basename(info.cssBundle) : '' };
  }
  for (const [page, entry] of Object.entries(PAGES)) {
    const src = path.join(root, 'client', `${page}.html`);
    if (!fs.existsSync(src) || !out[entry]) continue;
    let html = fs.readFileSync(src, 'utf8').replace('%JS%', `assets/${out[entry].js}`);
    html = out[entry].css ? html.replace('%CSS%', `assets/${out[entry].css}`) : html.replace(/<link rel="stylesheet" href="%CSS%">\n?/, '');
    fs.writeFileSync(path.join(dist, `${page}.html`), html);
  }
}

const entryPoints = Object.fromEntries(Object.values(PAGES).filter((e) => fs.existsSync(path.join(root, 'client/src', `${e}.js`))).map((e) => [e, `client/src/${e}.js`]));
const options = {
  entryPoints, bundle: true, format: 'esm', target: 'es2022', outdir: path.join(dist, 'assets'),
  entryNames: dev ? '[name]' : '[name]-[hash]', assetNames: '[name]-[hash]', minify: !dev, sourcemap: dev ? 'linked' : false,
  metafile: true, legalComments: 'none', define: { __DEV__: JSON.stringify(dev), __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  loader: { '.png': 'file', '.svg': 'file', '.woff2': 'file', '.woff': 'file' }, logLevel: 'info', absWorkingDir: root,
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
copyDir(path.join(root, 'client/public'), dist);
if (watch) {
  const ctx = await esbuild.context({ ...options, plugins: [{ name: 'pages', setup: (b) => b.onEnd((r) => r.metafile && writePages(r.metafile)) }] });
  await ctx.watch();
} else {
  const r = await esbuild.build(options);
  writePages(r.metafile);
}
