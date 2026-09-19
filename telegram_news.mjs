import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

const newsFile = "news.json";
const offsetFile = "telegram_offset.json";

// قراءة الأخبار الحالية دون فقدانها
let news = [];

if (fs.existsSync(newsFile)) {
  const saved = JSON.parse(
    fs.readFileSync(newsFile, "utf8")
  );

  if (Array.isArray(saved)) {
    news = saved;
  } else if (Array.isArray(saved.items)) {
    news = saved.items;
  }
}

let offset = 0;

if (fs.existsSync(offsetFile)) {
  offset =
    Number(fs.readFileSync(offsetFile, "utf8")) || 0;
}

const url =
  `https://api.telegram.org/bot${token}/getUpdates` +
  `?timeout=10&offset=${offset}`;

const response = await fetch(url);

if (!response.ok) {
  throw new Error(`Telegram API error: ${response.status}`);
}

const data = await response.json();

if (!data.ok) {
  throw new Error("Telegram API returned an error");
}

let newOffset = offset;

for (const update of data.result) {
  newOffset = Math.max(
    newOffset,
    update.update_id + 1
  );

  const post = update.channel_post;

  if (!post || !post.text) {
    continue;
  }

  const channel =
    post.chat?.title || "Telegram";

  const username =
    post.chat?.username || "";

  const messageId = post.message_id;

  const link = username
    ? `https://t.me/${username}/${messageId}`
    : "";

  // استخدام عنوان مختصر بدل نسخ المنشور بالكامل
  const lines = post.text
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const title =
    lines[0]?.slice(0, 200) ||
    "خبر من Telegram";

  const description =
    post.text.slice(0, 240);

  const item = {
    title,
    link,
    description,
    date: new Date(
      post.date * 1000
    ).toISOString(),
    source: channel,
    sourceScore: 8,
    sourceType: "telegram",
    cat: "العالم",
    image: "",
    sourceCount: 1,
    sources: [channel]
  };

  const exists = news.some(x =>
    link &&
    x.link &&
    x.link === link
  );

  if (!exists && link) {
    news.push(item);

    console.log(
      `تمت إضافة خبر Telegram من: ${channel}`
    );
  }
}

// الحفاظ على بنية news.json
const output = {
  updatedAt: new Date().toISOString(),
  items: news
};

fs.writeFileSync(
  newsFile,
  JSON.stringify(output, null, 2),
  "utf8"
);

fs.writeFileSync(
  offsetFile,
  String(newOffset),
  "utf8"
);

console.log(
  `Telegram updates: ${data.result.length}`
);

console.log(
  `News total: ${news.length}`
);
