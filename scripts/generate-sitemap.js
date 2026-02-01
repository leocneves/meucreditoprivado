import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👉 MESMO ARQUIVO DO FRONT
const CSV_PATH = path.join(
  __dirname,
  "../public/data/assets_master.csv"
);

const BASE_URL = "https://leocneves.github.io/meucreditoprivado";

const OUTPUT_PATH = path.join(
  __dirname,
  "../public/sitemap.xml"
);

// -----------------------------

function fetchCSVNode() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV não encontrado: ${CSV_PATH}`);
  }

  const csvText = fs.readFileSync(CSV_PATH, "utf-8");

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true
  });

  return parsed.data;
}

// -----------------------------

function generateSitemap(assets) {
  const urls = [];

  // homepage
  urls.push(`${BASE_URL}/#/`);

  // páginas dos ativos
  for (const asset of assets) {
    if (!asset.ticker) continue;

    urls.push(`${BASE_URL}/#/asset/${asset.ticker}`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `
  <url>
    <loc>${url}</loc>
  </url>
`).join("")}
</urlset>`;
}

// -----------------------------

function main() {
  console.log("📄 Lendo assets_master.csv...");

  const assets = fetchCSVNode();

  console.log(`✅ ${assets.length} ativos carregados`);

  const sitemap = generateSitemap(assets);

  fs.writeFileSync(OUTPUT_PATH, sitemap);

  console.log("🗺️ sitemap.xml gerado com sucesso!");
}

main();
