const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN مفقود");
}

// قناة موجز نيوز
const chatId = "-1003903387964";

// RSS الخاص بـ RT Arabic
const feedUrl = "https://arabic.rt.com/rss/";

// جلب RSS
const response = await fetch(feedUrl, {
  headers: {
    "User-Agent": "MowjazNews/4.0"
  }
});

if (!response.ok) {
  throw new Error(`RT Arabic RSS error: ${response.status}`);
}

const xml = await response.text();

// استخراج عناصر RSS
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  .slice(0, 10)
  .map(match => {
    const item = match[1];

    const get = (tag) => {
      const regex = new RegExp(
        `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
        "i"
      );

      const found = item.match(regex);

      if (!found) return "";

      return found[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
    };

    return {
      title: get("title"),
      link: get("link"),
      description: get("description"),
      pubDate: get("pubDate")
    };
  })
  .filter(item => item.title && item.link);

// التأكد من وجود أخبار
if (!items.length) {
  throw new Error("لم يتم العثور على أخبار من RT Arabic");
}

console.log(`تم العثور على ${items.length} أخبار من RT Arabic`);

// إرسال الأخبار إلى موجز نيوز
for (const item of items) {

  const text =
`📰 RT Arabic

${item.title}

🔗 ${item.link}

<!--MOWJAZ_SOURCE:RT_ARABIC-->
<!--MOWJAZ_LINK:${item.link}-->`;

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

  console.log(`تم إرسال خبر RT: ${item.title}`);
}

console.log("انتهى نشر أخبار RT Arabic بنجاح");
