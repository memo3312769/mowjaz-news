import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN غير موجود");
}

const newsFile = "news.json";
const offsetFile = "telegram_offset.json";

let news = [];

if (fs.existsSync(newsFile)) {
  const savedNews = JSON.parse(fs.readFileSync(newsFile, "utf8"));

  news = Array.isArray(savedNews)
    ? savedNews
    : (Array.isArray(savedNews.news) ? savedNews.news : []);
}

let offset = 0;

if (fs.existsSync(offsetFile)) {
  offset = Number(fs.readFileSync(offsetFile, "utf8")) || 0;
}

const url =
  `https://api.telegram.org/bot${token}/getUpdates?timeout=10&offset=${offset}`;

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

  newOffset = Math.max(newOffset, update.update_id + 1);

  const post = update.channel_post;

  if (!post || !post.text) {
    continue;
  }

  const channel = post.chat?.title || "Telegram";
  const username = post.chat?.username || "";
  const messageId = post.message_id;

  const link = username
    ? `https://t.me/${username}/${messageId}`
    : "";

  const item = {
    title: post.text.slice(0, 200),
    link,
    description: post.text,
    date: new Date(post.date * 1000).toISOString(),
    source: channel,
    sourceScore: 8,
    sourceType: "telegram",
    cat: "العالم",
    image: "",
    sourceCount: 1,
    sources: [channel]
  };

  const exists = news.some(
    x =>
      x.link &&
      link &&
      x.link === link
  );

  if (!exists) {
    news.push(item);
    console.log(`تمت إضافة خبر من Telegram: ${channel}`);
  }
}

fs.writeFileSync(
  newsFile,
  JSON.stringify(news, null, 2),
  "utf8"
);

fs.writeFileSync(
  offsetFile,
  String(newOffset),
  "utf8"
);

console.log(`Telegram updates: ${data.result.length}`);
console.log(`News total: ${news.length}`);
