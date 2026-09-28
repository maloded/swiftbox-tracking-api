ТЗ — SwiftBox Tracking API
Цель

Маленький бэкенд для голосового ИИ-агента (Hanc.ai Workflow), который проверяет статус посылки по трек-номеру. Агент дёргает этот API через inline HTTP-вызов в Tool-ноде — без MCP, обычный REST.

Стек
NestJS (TypeScript)
Prisma ORM
PostgreSQL (в Docker)
Docker + docker-compose для локального запуска (api + postgres одним docker-compose up)
Модель данных (Prisma schema)
prisma
model Tracking {
  id            String   @id @default(uuid())
  trackingNumber String  @unique
  customerName  String
  status        String   // "delivered" | "in_transit" | "delayed" | "problem"
  eta           String   // human-readable date, e.g. "2026-09-28"
  address       String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Complaint {
  id             String   @id @default(uuid())
  trackingNumber String
  type           String   // "damaged" | "lost" | "wrong_item"
  details        String
  createdAt      DateTime @default(now())
}

model OtpChallenge {
  id              String    @id @default(uuid())
  trackingNumber  String
  codeHash        String
  expiresAt       DateTime
  attempts        Int       @default(0)
  consumedAt      DateTime?
  verifyToken     String?   @unique
  verifyExpiresAt DateTime?
  createdAt       DateTime  @default(now())
}

customerEmail (String?, nullable) также добавлен на Tracking — email на файле клиента, используется только для отправки OTP-кода, никогда не берётся со слов звонящего.

Авторизация

Все /tracking/* маршруты (включая OTP-эндпоинты) требуют заголовок x-api-key равный переменной окружения API_KEY. /health открыт без авторизации. Если API_KEY не задана — проверка пропускается (для локальной разработки), в лог пишется предупреждение.

Эндпоинты
GET /health

Возвращает { "status": "ok" }. Для проверки Railway/Docker healthcheck.

GET /tracking/:trackingNumber

Возвращает статус посылки.

Успех (200):

json
{
  "trackingNumber": "SB12345",
  "customerName": "John Doe",
  "status": "in_transit",
  "eta": "2026-09-28",
  "address": "123 Main St",
  "eta_spoken": "September 28th"
}

Не найдено (404):

json
{ "statusCode": 404, "message": "Tracking number not found" }
PATCH /tracking/:trackingNumber/reschedule

Требует verifyToken (см. раздел "OTP-верификация" ниже) — токен, полученный через POST /tracking/:trackingNumber/otp/verify для ЭТОГО trackingNumber.

Body:

json
{ "newDate": "2026-09-30", "verifyToken": "..." }

Правила:

Разрешено только если текущий status == "in_transit".
Если status — delivered, delayed или problem — вернуть 400 с понятным сообщением (агент должен уметь передать это в разговор через переменную ответа).
Если verifyToken отсутствует/невалиден/просрочен/выдан для другого trackingNumber — 401.
При успехе обновляет eta на newDate, возвращает обновлённую запись.

Успех (200): обновлённый объект Tracking (как в GET).

Ошибка (400):

json
{ "statusCode": 400, "message": "Cannot reschedule a package with status 'delivered'" }

Ошибка (401):

json
{ "statusCode": 401, "message": "Verification required" }
POST /tracking/:trackingNumber/complaint

Требует verifyToken так же, как reschedule. Дополнительно теперь требует существующий trackingNumber (404, если неизвестен) — раньше жалоба создавалась и для неизвестного трек-номера.

Body:

json
{ "type": "damaged", "details": "Box arrived crushed, item inside broken", "verifyToken": "..." }

type — один из: damaged, lost, wrong_item.

Создаёт запись Complaint, возвращает её. Также обновляет статус связанной Tracking-записи на "problem".

Успех (201):

json
{
  "id": "...",
  "trackingNumber": "SB12345",
  "type": "damaged",
  "details": "...",
  "createdAt": "..."
}

Ошибки: 401 (см. выше), 404 { "statusCode": 404, "message": "Tracking number not found" }

OTP-верификация

POST /tracking/:trackingNumber/otp/send — отправляет 6-значный код на customerEmail, привязанный к посылке (email никогда не берётся от звонящего). trackingNumber нормализуется (убираются пробелы/дефисы, приводится к верхнему регистру) перед поиском.

Успех (200): { "otpSent": true, "maskedEmail": "a***@gmail.com" }
404 — неизвестный trackingNumber.
409 { "statusCode": 409, "message": "No email on file" } — у посылки нет email на файле.
429 { "statusCode": 429, "message": "Please wait before requesting a new code" } — повторный запрос раньше чем через OTP_COOLDOWN_MS (по умолчанию 60с) после предыдущего.
502 { "statusCode": 502, "message": "Could not send the code" } — SMTP не смог отправить письмо.

Код живёт OTP_TTL_MS (по умолчанию 10 мин), хешируется как HMAC-SHA256(code, OTP_SECRET). Новый запрос инвалидирует предыдущие неиспользованные коды для этого trackingNumber.

POST /tracking/:trackingNumber/otp/verify — body: { "code": "123456" }. Код можно продиктовать словами ("one two three four five six") или цифрами ("1 2 3 4 5 6" / "123456") — приводится к 6 цифрам перед сравнением.

Успех (200): { "otpVerified": true, "verifyToken": "..." } — verifyToken живёт OTP_VERIFY_TTL_MS (по умолчанию 15 мин) и привязан к этому trackingNumber.
401 { "statusCode": 401, "message": "Code expired or not requested", "otpVerified": false } — нет открытого (неиспользованного, непросроченного, <3 попыток) challenge.
401 { "statusCode": 401, "message": "Invalid code", "otpVerified": false, "attemptsLeft": N } — неверный код; после 3 неверных попыток challenge считается мёртвым.

Сид-данные (seed script)

Заполнить таблицу Tracking минимум 6 тестовыми записями, по одной-две на каждый статус:

trackingNumber	customerName	status	eta
SB10001	Anna Kovalenko	delivered	2026-09-20
SB10002	John Smith	in_transit	2026-09-28
SB10003	Maria Lopez	in_transit	2026-09-27
SB10004	Tom Wilson	delayed	2026-10-02
SB10005	Elena Petrova	problem	—
SB10006	David Brown	delivered	2026-09-18

Скрипт сида должен быть идемпотентным (upsert по trackingNumber, не дублировать записи при повторном запуске).

Docker

docker-compose.yml поднимает два сервиса:

api — сама NestJS-приложение, порт 3000
db — postgres:16, с volume для персистентности, healthcheck

Dockerfile для api — multi-stage build (build stage с полными deps, production stage только с runtime deps + скомпилированным dist).

При старте контейнера api — сначала prisma migrate deploy, потом seed-скрипт (если данные ещё не заполнены), потом запуск сервера.

Валидация и обработка ошибок
Использовать class-validator для DTO (body у reschedule и complaint).
Глобальный ValidationPipe с whitelist: true.
Если trackingNumber в пути не соответствует ничему в базе — везде единообразный 404 с понятным message (агент будет транслировать это звонящему).
Переменные окружения
DATABASE_URL=postgresql://user:password@db:5432/swiftbox
PORT=3000
API_KEY — ключ для заголовка x-api-key на /tracking/*; не задана = проверка пропускается (dev).
OTP_SECRET — секрет для HMAC-SHA256 хеширования OTP-кодов.
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM — SMTP для отправки кода (nodemailer).
OTP_COOLDOWN_MS, OTP_TTL_MS, OTP_VERIFY_TTL_MS — опциональные переопределения таймингов (для тестов); по умолчанию 60000 / 600000 / 900000.
Деплой

После локальной проверки через docker-compose up — задеплоить на Railway (Railway поддерживает деплой по Dockerfile напрямую, плюс managed Postgres через их собственный плагин — можно использовать вместо контейнера db в проде, уточнить по ходу дела, что проще).

Критерий готовности
docker-compose up поднимает api + postgres, миграции и сиды применяются автоматически.
curl http://localhost:3000/tracking/SB10002 возвращает корректный JSON.
curl -X PATCH http://localhost:3000/tracking/SB10002/reschedule -d '{"newDate":"2026-10-01"}' -H "Content-Type: application/json" успешно обновляет eta.
curl -X PATCH http://localhost:3000/tracking/SB10001/reschedule ... (delivered) возвращает 400 с понятным сообщением.
curl -X POST http://localhost:3000/tracking/SB10005/complaint -d '{"type":"damaged","details":"test"}' -H "Content-Type: application/json" создаёт жалобу.