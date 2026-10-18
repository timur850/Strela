// ⚙️ Настройки ЭТОЙ копии STRELA CASE. Остальные файлы во всех копиях одинаковые.
export const CONFIG = {
  NAME: "STRELA CASE",                      // название в боте и мини-аппе
  OWNERS: ["PODONOK_UC_1", "Sdelka_ton"],   // владельцы админки (username без @)
  SUPPORT: "@PODONOK_UC_1",                 // контакт поддержки
  GIFT_ACC: "Sdelka_ton",                   // аккаунт, куда игроки отправляют подарки (без @)
  BOT_TOKEN: "",                            // пусто = берётся секрет BOT_TOKEN из Cloudflare
  // бесплатный кейс (раз в 24 ч): сначала поделиться ссылкой в N чатов и подписаться на канал. Меняется в админке
  FREE_GATE: { on: false, shares: 3, channel: "", hours: 24 },
  TON_WALLET: "",                           // кошелёк для пополнений TON (админка → 💎 Оплата важнее)
  DEFAULT_ORIGIN: "https://strela.timalukyang.workers.dev", // адрес воркера (можно оставить пустым)
};
