// Netlify Serverless Function: Google News RSS to JSON with caching (ES Module)
export async function handler(event) {
  const query = event.queryStringParameters?.q;
  if (!query) {
    return {
      statusCode: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Missing query parameter 'q'" }),
    };
  }

  const cleanQ = query.trim();
  const searchParam = cleanQ.includes("when:") ? cleanQ : `"${cleanQ}" when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchParam)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: "Failed to fetch Google News RSS" }),
      };
    }

    const xml = await resp.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/) || itemXml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);

      let title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
      let source = sourceMatch ? sourceMatch[1].replace(/&amp;/g, "&") : "";

      if (!source && title.includes(" - ")) {
        const parts = title.split(" - ");
        source = parts.pop().trim();
        title = parts.join(" - ").trim();
      } else if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3)).trim();
      }

      const link = linkMatch ? linkMatch[1] : "";
      const pubDate = pubDateMatch ? pubDateMatch[1] : "";

      if (title && link) {
        items.push({
          title,
          source: source || "Google News",
          link,
          pubDate,
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        query: cleanQ,
        total: items.length,
        items,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
