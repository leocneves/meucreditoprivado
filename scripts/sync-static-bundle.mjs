import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const docsIndex = path.join(rootDir, 'docs', 'index.html');

if (!fs.existsSync(docsIndex)) {
  console.log('⚠️ docs/index.html não encontrado, pulando sincronização de bundle.');
  process.exit(0);
}

const indexContent = fs.readFileSync(docsIndex, 'utf-8');
const match = indexContent.match(/<script\s+type="module"\s+crossorigin\s+src="(\/assets\/(index-[^"]+\.js))"><\/script>/);

if (!match) {
  console.log('⚠️ Tag de bundle não encontrada em docs/index.html.');
  process.exit(0);
}

const currentBundleSrc = match[1];
const currentBundleFilename = match[2];
const newScriptTag = `<script type="module" crossorigin src="${currentBundleSrc}"></script>`;
const scriptRegex = /<script\s+type="module"\s+crossorigin\s+src="\/assets\/index-[^"]+\.js"><\/script>/g;

// Sincroniza CSS compilado pelo Vite para /index.css (public/ e docs/) eliminando 404 em todas as páginas pré-renderizadas
const assetsDir = path.join(rootDir, 'docs', 'assets');
const cssMatch = indexContent.match(/<link\s+rel="stylesheet"[^>]*href="(\/assets\/(index-[^"]+\.css))"[^>]*>/);
let compiledCssPath = null;
if (cssMatch) {
  const candidate = path.join(rootDir, 'docs', cssMatch[1].replace(/^\//, ''));
  if (fs.existsSync(candidate)) compiledCssPath = candidate;
}
if (!compiledCssPath && fs.existsSync(assetsDir)) {
  const cssFiles = fs
    .readdirSync(assetsDir)
    .filter((f) => f.startsWith('index-') && f.endsWith('.css'))
    .sort((a, b) => fs.statSync(path.join(assetsDir, b)).mtimeMs - fs.statSync(path.join(assetsDir, a)).mtimeMs);
  if (cssFiles.length > 0) {
    compiledCssPath = path.join(assetsDir, cssFiles[0]);
  }
}

let syncedCssCount = 0;
if (compiledCssPath && fs.existsSync(compiledCssPath)) {
  for (const dest of [path.join(rootDir, 'docs', 'index.css'), path.join(rootDir, 'public', 'index.css')]) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(compiledCssPath, dest);
    syncedCssCount++;
  }
}

const staticSlugs = [
  'negocios',
  'charts',
  'ntnb',
  'primary',
  'raiox-devedor',
  'calculadora',
  'contact',
  'agenda',
  'comparar',
  'metodologia',
  'sobre',
  'termos',
  'privacidade',
];

let updatedStatic = 0;
for (const base of ['docs', 'public']) {
  for (const slug of staticSlugs) {
    const file = path.join(rootDir, base, slug, 'index.html');
    if (fs.existsSync(file)) {
      const html = fs.readFileSync(file, 'utf-8');
      const updated = html.replace(scriptRegex, newScriptTag);
      if (updated !== html) {
        fs.writeFileSync(file, updated, 'utf-8');
        updatedStatic++;
      }
    }
  }
}

// Também sincroniza bundles legados em docs/assets/ caso alguma página pré-renderizada ainda referencie um hash anterior
const currentBundlePath = path.join(assetsDir, currentBundleFilename);
let syncedBundles = 0;

if (fs.existsSync(assetsDir) && fs.existsSync(currentBundlePath)) {
  const files = fs.readdirSync(assetsDir);
  for (const f of files) {
    if (f.startsWith('index-') && f.endsWith('.js') && f !== currentBundleFilename) {
      fs.copyFileSync(currentBundlePath, path.join(assetsDir, f));
      syncedBundles++;
    }
  }
}

const docsStaticAuthPath = path.join(assetsDir, 'static-auth.js');
const publicAssetsDir = path.join(rootDir, 'public', 'assets');
const publicStaticAuthPath = path.join(publicAssetsDir, 'static-auth.js');
if (fs.existsSync(docsStaticAuthPath)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
  fs.copyFileSync(docsStaticAuthPath, publicStaticAuthPath);
}

console.log(
  `✅ Bundle sincronizado (${currentBundleSrc}): ${updatedStatic} páginas estáticas, ${syncedBundles} bundles legados e ${syncedCssCount} arquivos index.css atualizados.`
);
