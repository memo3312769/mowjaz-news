const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN غير موجود");
}

// قناة موجز نيوز
const chatId = "-1003903387964";

// مصدر RT Arabic
const feedUrl = "https://arabic.rt.com/rss/";

// جلب RSS
const response = await fetch(feedUrl);

if (!response.ok) {
  throw new Error(`RT RSS error: ${response.status}`);
}

const xml = await response.text();

// استخراج أول 5 أخبار
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  .slice(0, 5)
  .map(match => {
    const item = match[1];

    const get = (tag) => {
      const m = item.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
      );
      return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    };

    return {
      title: get("title"),
      link: get("link"),
      description: get("description")
    };
  })
  .filter(x => x.title && x.link);

// إذا لم نجد أخبارًا
if (!items.length) {
  throw new Error("لم يتم العثور على أخبار من RT Arabic");
}

// إرسال الأخبار إلى موجز نيوز
for (const item of items) {
  const text =
`📰 RT Arabic

${item.title}

🔗 ${item.link}`;

  const sendUrl =
    `https://api.telegram.org/bot${token}/sendMessage`;

  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const result = await sendResponse.json();

  if (!result.ok) {
    throw new Error(
      `Telegram error: ${JSON.stringify(result)}`
    );
  }

  console.log("تم نشر:", item.title);
}
