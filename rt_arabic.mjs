import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

const telegramChatId = "-1003903387964";

const feedUrl = "https://arabic.rt.com/rss/";

const newsFile = "news.json";

// ===============================
// قراءة news.json الحالي
// ===============================

let newsData = {
  updatedAt: new Date().toISOString(),
  items: []
};

if (fs.existsSync(newsFile)) {
  try {
    const saved = JSON.parse(
      fs.readFileSync(newsFile, "utf8")
    );

    if (saved && Array.isArray(saved.items)) {
      newsData = saved;
    }
  } catch (error) {
    console.log(
      "تعذر قراءة news.json، سيتم استخدام ملف جديد"
    );
  }
}

// ===============================
// تحميل RT Arabic RSS
// ===============================

const response = await fetch(feedUrl);

if (!response.ok) {
  throw new Error(
    `RT RSS error: ${response.status}`
  );
}

const xml = await response.text();

// ===============================
// استخراج العناصر
// ===============================

const items = [
  ...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)
]
  .slice(0, 10)
  .map(match => {
    const item = match[1];

    const get = tag => {
      const regex = new RegExp(
        `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
        "i"
      );

      const result = item.match(regex);

      if (!result) {
        return "";
      }

      return result[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
    };

    const title = get("title");
    const link = get("link");
    const description = get("description");
    const pubDate = get("pubDate");

    return {
      title,
      link,
      description,
      date: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString()
    };
  })
  .filter(item => item.title && item.link);

// ===============================
// معالجة الأخبار
// ===============================

let added = 0;
let sent = 0;

for (const item of items) {

  // منع تكرار الخبر داخل news.json
  const exists = newsData.items.some(existing =>
    existing.link === item.link ||
    existing.title === item.title
  );

  if (exists) {
    console.log(
      `خبر موجود بالفعل: ${item.title}`
    );
    continue;
  }

  // =============================
  // إنشاء خبر جديد
  // =============================

  const newsItem = {
    title: item.title,
    link: item.link,
    description: item.description.slice(0, 500),
    date: item.date,
    source: "RT Arabic",
    sourceScore: 8,
    sourceType: "official-rss",
    cat: "العالم",
    image: "",
    sourceCount: 1,
    sources: ["RT Arabic"]
  };

  // إضافة الخبر في بداية القائمة
  newsData.items.unshift(newsItem);

  added++;

  console.log(
    `تمت إضافة خبر RT إلى news.json: ${item.title}`
  );

  // =============================
  // إرسال الخبر إلى Telegram
  // =============================

  const sendUrl =
    `https://api.telegram.org/bot${token}/sendMessage`;

  const text =
    `📰 RT Arabic\n\n` +
    `${item.title}\n\n` +
    `🔗 ${item.link}`;

  const sendResponse = await fetch(sendUrl, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      chat_id: telegramChatId,
      text
    })
  });

  const result = await sendResponse.json();

  if (!result.ok) {
    console.log(
      `فشل إرسال الخبر إلى Telegram: ${item.title}`
    );
  } else {
    sent++;

    console.log(
      `تم إرسال خبر RT إلى Telegram: ${item.title}`
    );
  }
}

// ===============================
// الحفاظ على حجم news.json
// ===============================

// نحتفظ بآخر 160 خبرًا فقط
newsData.items = newsData.items.slice(0, 160);

newsData.updatedAt =
  new Date().toISOString();

// ===============================
// حفظ news.json
// ===============================

fs.writeFileSync(
  newsFile,
  JSON.stringify(newsData, null, 2),
  "utf8"
);

// ===============================
// النتيجة النهائية
// ===============================

console.log(
  `RT Arabic: تم فحص ${items.length} أخبار`
);

console.log(
  `RT Arabic: تمت إضافة ${added} أخبار جديدة إلى news.json`
);

console.log(
  `RT Arabic: تم إرسال ${sent} أخبار إلى Telegram`
);

console.log(
  `إجمالي أخبار news.json: ${newsData.items.length}`
);
