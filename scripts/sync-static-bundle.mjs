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

// Também sincroniza bundles legados em docs/assets/ para garantir que qualquer HTML pré-renderizado sirva o bundle mais recente
const assetsDir = path.join(rootDir, 'docs', 'assets');
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

console.log(`✅ Bundle sincronizado (${currentBundleSrc}): ${updatedStatic} páginas estáticas e ${syncedBundles} bundles legados atualizados.`);
