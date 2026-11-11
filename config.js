// ⚙️ Настройки ЭТОЙ копии STRELA CASE. Остальные файлы во всех копиях одинаковые.
export const CONFIG = {
  NAME: "STRELA CASE",                      // название в боте и мини-аппе
  OWNERS: ["PODONOK_UC_1", "Sdelka_ton", "StrelaCase_bot_support"],   // владельцы админки (username без @)
  SUPPORT: "@StrelaCase_bot_support",                 // контакт поддержки
  GIFT_ACC: "StrelaCase_bot_support",                   // аккаунт, куда игроки отправляют подарки (без @)
  BOT_TOKEN: "",                            // пусто = берётся секрет BOT_TOKEN из Cloudflare
  // бесплатный кейс (раз в 24 ч): сначала поделиться ссылкой в N чатов и подписаться на канал. Меняется в админке
  FREE_GATE: { on: false, shares: 3, channel: "", hours: 24 },
  TON_WALLET: "UQADdjILhx54YNuA4b954DJfRPLwqxhASul3yqDO_-I-XNW1",                           // кошелёк для пополнений TON (админка → 💎 Оплата важнее)
  // STRELA STARS: пополнение казино картой UA / РФ через бот продажи звёзд (пусто — способ «Карта» скрыт)
  STARS_URL: "https://strela-stars.timalukyang.workers.dev",
  DEFAULT_ORIGIN: "https://strela.timalukyang.workers.dev", // адрес воркера (можно оставить пустым)
};
