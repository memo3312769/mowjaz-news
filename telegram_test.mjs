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
