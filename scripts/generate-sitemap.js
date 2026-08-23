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

const BASE_URL = "https://fixdata.netlify.app";

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
  const today = new Date().toISOString().split('T')[0];

  // páginas estáticas
  urls.push({ loc: `${BASE_URL}/`, priority: "1.0", changefreq: "daily" });
  urls.push({ loc: `${BASE_URL}/charts`, priority: "0.9", changefreq: "daily" });
  urls.push({ loc: `${BASE_URL}/primary`, priority: "0.9", changefreq: "daily" });

  // páginas dos ativos
  for (const asset of assets) {
    if (!asset.ticker || asset.ticker === "nan" || asset.ticker === "N/A") continue;

    urls.push({
      loc: `${BASE_URL}/asset/${encodeURIComponent(asset.ticker.trim())}`,
      priority: "0.8",
      changefreq: "daily"
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
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
