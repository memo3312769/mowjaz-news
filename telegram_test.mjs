const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN غير موجود");
}

const url = `https://api.telegram.org/bot${token}/getUpdates`;

const response = await fetch(url);

if (!response.ok) {
  throw new Error(`Telegram API error: ${response.status}`);
}

const data = await response.json();

console.log(JSON.stringify(data, null, 2));
const chatId = "-1003903387964";

const sendUrl =
  `https://api.telegram.org/bot${token}/sendMessage`;

const sendResponse = await fetch(sendUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    chat_id: chatId,
    text: "🟢 اختبار ناجح — موجز نيوز يعمل مع البوت."
  })
});

const sendData = await sendResponse.json();

console.log(JSON.stringify(sendData, null, 2));
