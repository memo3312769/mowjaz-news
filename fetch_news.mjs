import fs from "node:fs/promises";

const UA = "MowjazNews/2.0";

const feeds = [
  ["BBC العربية", "https://feeds.bbci.co.uk/arabic/rss.xml", "العالم"],
  ["BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml", "العالم"],
  ["BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml", "اقتصاد"],
  ["BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml", "تكنولوجيا"],

  ["Google News مصر", "https://news.google.com/rss/search?q=%D9%85%D8%B5%D8%B1+%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1&hl=ar&gl=EG&ceid=EG:ar", "مصر"],

  ["Google News رياضة", "https://news.google.com/rss/search?q=%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9+%D9%85%D8%B5%D8%B1&hl=ar&gl=EG&ceid=EG:ar", "رياضة"],

  ["Google News علوم", "https://news.google.com/rss/search?q=%D8%B9%D9%84%D9%88%D9%85+%D9%81%D8%B6%D8%A7%D8%A1+%D8%B7%D8%A8&hl=ar&gl=EG&ceid=EG:ar", "علوم"],

  ["Google News تكنولوجيا", "https://news.google.com/rss/search?q=%D8%AA%D9%83%D9%86%D9%88%D9%84%D9%88%D8%AC%D9%8A%D8%A7+%D8%B0%D9%83%D8%A7%D8%A1+%D8%A7%D8%B5%D8%B7%D9%86%D8%A7%D8%B9%D9%8A&hl=ar&gl=EG&ceid=EG:ar", "تكنولوجيا"],

  ["Google News اقتصاد", "https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+%D8%A3%D8%B3%D9%88%D8%A7%D9%82+%D8%A8%D9%88%D8%B1%D8%B5%D8%A9&hl=ar&gl=EG&ceid=EG:ar", "اقتصاد"]
];

const strip = (s = "") =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const between = (s, a, b) => {
  const i = s.indexOf(a);
  if (i < 0) return "";
  const j = s.indexOf(b, i + a.length);
  return strip(s.slice(i + a.length, j < 0 ? s.length : j));
};

const attr = (s, tag, name) => {
  const m = s.match(
    new RegExp(`<${tag}\\b[^>]*\\b${name}=["']([^"']+)["']`, "i")
  );
  return m ? m[1] : "";
};

const norm = (s) =>
  strip(s)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function similarity(a, b) {
  const A = new Set(norm(a).split(" ").filter((x) => x.length > 2));
  const B = new Set(norm(b).split(" ").filter((x) => x.length > 2));

  let n = 0;

  for (const x of A) {
    if (B.has(x)) n++;
  }

  return n / Math.max(A.size, B.size, 1);
}

function imageFromChunk(x) {
  return (
    attr(x, "media:content", "url") ||
    attr(x, "media:thumbnail", "url") ||
    attr(x, "enclosure", "url") ||
    ""
  );
}

async function feed([source, url, category]) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA
      }
    });

    if (!res.ok) return [];

    const text = await res.text();

    const chunks = text.split(/<item\b/i).slice(1);

    return chunks
      .slice(0, 40)
      .map((x) => ({
        title: between(x, "<title>", "</title>"),

        link:
          between(x, "<link>", "</link>") ||
          attr(x, "link", "href"),

        description:
          between(x, "<description>", "</description>") ||
          between(x, "<summary>", "</summary>"),

        date:
          between(x, "<pubDate>", "</pubDate>") ||
          between(x, "<published>", "</published>") ||
          between(x, "<updated>", "</updated>") ||
          new Date().toISOString(),

        source,

        cat: category,

        image: imageFromChunk(x)
      }))
      .filter((x) => x.title && x.link);

  } catch {
    return [];
  }
}

const rows = (await Promise.all(feeds.map(feed)))
  .flat()
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const unique = [];

for (const x of rows) {
  const same = unique.find(
    (y) => similarity(x.title, y.title) >= 0.72
  );

  if (!same) {
    unique.push(x);
  } else if (!same.image && x.image) {
    same.image = x.image;
  }
}

const priority = [
  "مصر",
  "العالم",
  "اقتصاد",
  "رياضة",
  "تكنولوجيا",
  "علوم"
];

const balanced = [];

for (const cat of priority) {
  balanced.push(
    ...unique
      .filter((x) => x.cat === cat)
      .slice(0, 15)
  );
}

balanced.push(
  ...unique.filter((x) => !priority.includes(x.cat))
);

const out = {
  updatedAt: new Date().toISOString(),
  items: balanced.slice(0, 140)
};

await fs.writeFile(
  "news.json",
  JSON.stringify(out, null, 2),
  "utf8"
);

console.log(
  `Saved ${out.items.length} news items.`
);
