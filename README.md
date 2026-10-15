# STRELA CASE

Telegram-бот + мини-апп. Работает на Cloudflare Workers — бесплатно, 24/7, без ПК и VPS.

## Запуск (один раз)
1. dash.cloudflare.com → Workers & Pages → Create → Import a repository → выбрать `Strela` → Deploy
2. Воркер → Settings → Variables and Secrets → Add → тип **Secret**, имя `BOT_TOKEN`, значение — токен бота → Deploy
3. Открыть `https://<воркер>.workers.dev/setup` — бот подключится сам

Владельцы админки — `OWNERS` в `worker.js`. Сайт игры — `site/index.html`.

## Как устроено
Баланс, билеты и подарки игроков хранятся на сервере (`game.js`), там же решается результат каждой игры.
Общий каталог подарков и шансы — `site/logic.js` (его используют и мини-апп, и сервер).
