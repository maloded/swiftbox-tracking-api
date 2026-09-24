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
  "address": "123 Main St"
}

Не найдено (404):

json
{ "statusCode": 404, "message": "Tracking number not found" }
PATCH /tracking/:trackingNumber/reschedule

Body:

json
{ "newDate": "2026-09-30" }

Правила:

Разрешено только если текущий status == "in_transit".
Если status — delivered, delayed или problem — вернуть 400 с понятным сообщением (агент должен уметь передать это в разговор через переменную ответа).
При успехе обновляет eta на newDate, возвращает обновлённую запись.

Успех (200): обновлённый объект Tracking (как в GET).

Ошибка (400):

json
{ "statusCode": 400, "message": "Cannot reschedule a package with status 'delivered'" }
POST /tracking/:trackingNumber/complaint

Body:

json
{ "type": "damaged", "details": "Box arrived crushed, item inside broken" }

type — один из: damaged, lost, wrong_item.

Создаёт запись Complaint, возвращает её. Также должен обновить статус связанной Tracking-записи на "problem" (если trackingNumber существует в Tracking; если нет — всё равно создать Complaint отдельно, не падать).

Успех (201):

json
{
  "id": "...",
  "trackingNumber": "SB12345",
  "type": "damaged",
  "details": "...",
  "createdAt": "..."
}
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
Деплой

После локальной проверки через docker-compose up — задеплоить на Railway (Railway поддерживает деплой по Dockerfile напрямую, плюс managed Postgres через их собственный плагин — можно использовать вместо контейнера db в проде, уточнить по ходу дела, что проще).

Критерий готовности
docker-compose up поднимает api + postgres, миграции и сиды применяются автоматически.
curl http://localhost:3000/tracking/SB10002 возвращает корректный JSON.
curl -X PATCH http://localhost:3000/tracking/SB10002/reschedule -d '{"newDate":"2026-10-01"}' -H "Content-Type: application/json" успешно обновляет eta.
curl -X PATCH http://localhost:3000/tracking/SB10001/reschedule ... (delivered) возвращает 400 с понятным сообщением.
curl -X POST http://localhost:3000/tracking/SB10005/complaint -d '{"type":"damaged","details":"test"}' -H "Content-Type: application/json" создаёт жалобу.