
import fs from "node:fs/promises";

const UA = "MowjazNews/3.0";

/*
  مستويات المصادر:
  10 = مصدر رسمي قوي
   8 = مصدر إخباري موثوق عبر RSS
   6 = مصدر تجميعي / اكتشاف
*/

const feeds = [
  // =========================
  // BBC
  // =========================

  {
    source: "BBC العربية",
    url: "https://feeds.bbci.co.uk/arabic/rss.xml",
    category: "العالم",
    score: 10,
    type: "official-rss"
  },

  {
    source: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "العالم",
    score: 10,
    type: "official-rss"
  },

  {
    source: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    category: "اقتصاد",
    score: 10,
    type: "official-rss"
  },

  {
    source: "BBC Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    category: "تكنولوجيا",
    score: 10,
    type: "official-rss"
  },
    {
    source: "France 24 العربية",
    url: "https://www.france24.com/ar/rss",
    category: "العالم",
    score: 10,
    type: "official-rss"
  },
  
{
  source: "Sky News عربية",
  url: "https://www.skynewsarabia.com/rss.xml",
  category: "العالم",
  score: 10,
  type: "official-rss"
},
  // =========================
  // DW عربية
  // =========================

 

  // =========================
  // Google News
  // مصدر اكتشاف وليس ناشراً أصلياً
  // =========================

  {
    source: "Google News مصر",
    url: "https://news.google.com/rss/search?q=%D9%85%D8%B5%D8%B1+%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1&hl=ar&gl=EG&ceid=EG:ar",
    category: "مصر",
    score: 6,
    type: "aggregator"
  },

  {
    source: "Google News رياضة",
    url: "https://news.google.com/rss/search?q=%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9+%D9%85%D8%B5%D8%B1&hl=ar&gl=EG&ceid=EG:ar",
    category: "رياضة",
    score: 6,
    type: "aggregator"
  },

  {
    source: "Google News علوم",
    url: "https://news.google.com/rss/search?q=%D8%B9%D9%84%D9%88%D9%85+%D9%81%D8%B6%D8%A7%D8%A1+%D8%B7%D8%A8&hl=ar&gl=EG&ceid=EG:ar",
    category: "علوم",
    score: 6,
    type: "aggregator"
  },

  {
    source: "Google News تكنولوجيا",
    url: "https://news.google.com/rss/search?q=%D8%AA%D9%83%D9%86%D9%88%D9%84%D9%88%D8%AC%D9%8A%D8%A7+%D8%B0%D9%83%D8%A7%D8%A1+%D8%A7%D8%B5%D8%B7%D9%86%D8%A7%D8%B9%D9%8A&hl=ar&gl=EG&ceid=EG:ar",
    category: "تكنولوجيا",
    score: 6,
    type: "aggregator"
  },

  {
    source: "Google News اقتصاد",
    url: "https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+%D8%A3%D8%B3%D9%88%D8%A7%D9%82+%D8%A8%D9%88%D8%B1%D8%B5%D8%A9&hl=ar&gl=EG&ceid=EG:ar",
    category: "اقتصاد",
    score: 6,
    type: "aggregator"
  }
];


// =========================
// تنظيف النص
// =========================

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


// =========================
// استخراج عنصر XML
// =========================

const between = (s, a, b) => {
  const i = s.indexOf(a);

  if (i < 0) return "";

  const j = s.indexOf(b, i + a.length);

  return strip(
    s.slice(
      i + a.length,
      j < 0 ? s.length : j
    )
  );
};


// =========================
// استخراج Attribute
// =========================

const attr = (s, tag, name) => {
  const pattern =
    "<" +
    tag +
    "\\b[^>]*\\b" +
    name +
    "=[\"']([^\"']+)[\"']";

  const m = s.match(new RegExp(pattern, "i"));

  return m ? m[1] : "";
};


// =========================
// توحيد النص العربي
// =========================

const norm = (s) =>
  strip(s)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();


// =========================
// تشابه العناوين
// =========================

function similarity(a, b) {

  const A = new Set(
    norm(a)
      .split(" ")
      .filter((x) => x.length > 2)
  );

  const B = new Set(
    norm(b)
      .split(" ")
      .filter((x) => x.length > 2)
  );

  let common = 0;

  for (const word of A) {
    if (B.has(word)) {
      common++;
    }
  }

  return common / Math.max(A.size, B.size, 1);
}


// =========================
// استخراج الصورة
// =========================

function imageFromChunk(x) {

  const media =
    attr(x, "media:content", "url") ||
    attr(x, "media:thumbnail", "url") ||
    attr(x, "enclosure", "url");

  if (media) {
    return media;
  }

  const img =
    x.match(
      /<img[^>]+src=["']([^"']+)["']/i
    );

  if (img && img[1]) {
    return img[1];
  }

  const og =
    x.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

  if (og && og[1]) {
    return og[1];
  }

  return "";
}


// =========================
// جلب Feed
// =========================

async function feed(config) {

  try {

    const res = await fetch(
      config.url,
      {
        headers: {
          "user-agent": UA
        }
      }
    );

    if (!res.ok) {

 console.log(
  "Feed failed: " +
  config.source +
  " (" +
  res.status +
  ")"
);     

      return [];
    }

    const text = await res.text();

    const chunks =
      text
        .split(/<item\b/i)
        .slice(1);

    return chunks
      .slice(0, 40)
      .map((x) => ({

        title:
          between(
            x,
            "<title>",
            "</title>"
          ),

        link:
          between(
            x,
            "<link>",
            "</link>"
          ) ||
          attr(
            x,
            "link",
            "href"
          ),

        description:
          between(
            x,
            "<description>",
            "</description>"
          ) ||
          between(
            x,
            "<summary>",
            "</summary>"
          ),

        date:
          between(
            x,
            "<pubDate>",
            "</pubDate>"
          ) ||
          between(
            x,
            "<published>",
            "</published>"
          ) ||
          between(
            x,
            "<updated>",
            "</updated>"
          ) ||
          new Date().toISOString(),

        source: config.source,

        sourceScore: config.score,

        sourceType: config.type,

        cat: config.category,

        image:
          imageFromChunk(x)

      }))
      .filter(
        (x) =>
          x.title &&
          x.link
      );

  } catch (error) {

   console.log(
  "Feed error: " +
  config.source
); 

    return [];
  }
}


// =========================
// تحميل جميع المصادر
// =========================

const rows =
  (
    await Promise.all(
      feeds.map(feed)
    )
  )
    .flat()
    .sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );


// =========================
// إزالة التكرار
// =========================

const unique = [];

for (const x of rows) {

  const same = unique.find(
    (y) =>
      similarity(x.title, y.title) >= 0.72
  );

  if (!same) {

    unique.push({
      ...x,
      sourceCount: 1,
      sources: [x.source]
    });

  } else {

    // إضافة المصدر الجديد إذا لم يكن موجودًا
    if (!same.sources.includes(x.source)) {
      same.sources.push(x.source);
      same.sourceCount = same.sources.length;
    }

    // الاحتفاظ بالمصدر الأعلى موثوقية
    if (x.sourceScore > same.sourceScore) {
      same.source = x.source;
      same.sourceScore = x.sourceScore;
      same.sourceType = x.sourceType;
    }

    // الاحتفاظ بصورة إذا لم تكن موجودة
    if (!same.image && x.image) {
      same.image = x.image;
    }

  }
}


// =========================
// ترتيب الأقسام
// =========================

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
      .filter(
        (x) =>
          x.cat === cat
      )
      .slice(0, 15)
  );

}


// أي تصنيف جديد مستقبلاً

balanced.push(
  ...unique.filter(
    (x) =>
      !priority.includes(
        x.cat
      )
  )
);


// =========================
// الناتج النهائي
// =========================

if (balanced.length === 0) {
  throw new Error(
    "لم يتم جلب أي أخبار. تم إيقاف الحفظ لحماية news.json."
  );
}

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
  "Saved " +
  out.items.length +
  " news items from " +
  feeds.length +
  " feeds."
);
