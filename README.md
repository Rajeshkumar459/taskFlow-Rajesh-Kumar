# TaskFlow

A task management system with authentication, projects, and tasks — built with Go, React, and PostgreSQL.

---

## 1. Overview

TaskFlow lets users register, log in, create projects, add tasks to those projects, and assign tasks to themselves or other users.

**Tech Stack:**

| Layer | Technology |
|---|---|
| Backend API | Go 1.23 · Gin · pgx v5 · golang-jwt |
| Frontend | React 19 · TypeScript · Material UI v7 · React Router v7 |
| Database | PostgreSQL 16 |
| Migrations | golang-migrate |
| Container | Docker Compose · multi-stage Dockerfile |
| Tests | Go stdlib `testing` · Vitest · Testing Library |

---

## 2. Architecture Decisions

**Go + Gin**: Gin is the most widely adopted Go HTTP framework with excellent middleware support, performance, and a predictable handler signature. The project uses a layered structure: `config` → `db` → `api/handlers` → `router` → `main.go`.

**pgx/v5 directly (no ORM)**: Using pgx with parameterised SQL gives full visibility into queries, avoids N+1 issues, and keeps the schema the source of truth. All SQL is in the `db` package and is intentionally readable.

**JWT in Authorization header**: Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`. This is the standard approach for SPAs. The 24h expiry is enforced server-side. The JWT secret is env-only — never committed.

**MUI v7**: Provides a polished, accessible component library out of the box. Combined with a custom theme, it avoids bikeshedding on CSS while producing professional results.

**Optimistic UI for task status**: Clicking the status chip on a task updates the local state immediately (UX feels instant), then calls the API in the background. On failure the previous state is restored.

**Migration fixup pattern**: The seeded user in migration `0002` had an invalid bcrypt hash (placeholder). Rather than modifying an applied migration, `0005_fix_seed_password` UPDATEs the row with a real cost-12 bcrypt hash. golang-migrate's `schema_migrations` table ensures it only runs once.

**What was intentionally left out:**
- Pagination (non-critical for the scope; `?page=&limit=` would be straightforward to add)
- WebSocket real-time updates (would require a broker layer)
- Refresh tokens (24h expiry is sufficient for the take-home scope)
- Dedicated user management endpoints (users exist only as assignees)

---

## 3. Running Locally

Requires only Docker Desktop.

```bash
git clone https://github.com/your-name/taskflow
cd taskflow

cp .env.example .env

docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080

The first build downloads Go modules and npm packages (~2–3 min). Subsequent starts are fast.

---

## 4. Running Migrations

Migrations run **automatically** on container startup via `entrypoint.sh` → `scripts/migrate.sh`. No manual steps needed.

If you want to run migrations manually:

```bash
docker compose exec backend /app/scripts/migrate.sh
```

To roll back one step:

```bash
docker run --rm \
  -e DB_HOST=localhost \
  -e DB_PORT=5432 \
  -e DB_USER=taskflow \
  -e DB_PASSWORD=taskflow \
  -e DB_NAME=taskflow \
  migrate/migrate \
  -path /app/migrations \
  -database "postgres://taskflow:taskflow@localhost:5432/taskflow?sslmode=disable" \
  down 1
```

---

## 5. Test Credentials

A seed user is created automatically:

```
Email:    test@example.com
Password: password123
```

A "Demo Project" with 3 tasks (todo / in_progress / done) is also seeded for immediate exploration.

---

## 6. API Reference

All endpoints return `Content-Type: application/json`. Protected endpoints require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password}` | `{token, user}` |
| POST | `/auth/login` | `{email, password}` | `{token, user}` |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects` | List projects user owns or has tasks in |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Project + tasks |
| PATCH | `/projects/:id` | Update name/description (owner only) |
| DELETE | `/projects/:id` | Delete project + tasks (owner only) |
| GET | `/projects/:id/stats` | Task counts by status and assignee |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks` | List tasks; supports `?status=` and `?assignee=` |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task fields |
| DELETE | `/tasks/:id` | Delete task (project owner only) |

**Error format:**
```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

---

## 7. Running Tests

```bash
# Backend tests (unit — no DB required; integration tests skip if TEST_DATABASE_URL is unset)
docker compose run --rm backend-test

# Frontend tests
docker compose run --rm frontend-test
```

---

## 8. What You'd Do With More Time

**Performance:**
- Pagination on list endpoints (`?page=&limit=`) — the query layer is ready for it
- Lazy-load the MUI icon bundle and code-split the router to reduce the 555 KB JS bundle

**Features:**
- Drag-and-drop Kanban board (react-dnd or @dnd-kit)
- Real-time task updates via WebSocket (gorilla/websocket on the backend)
- Project member invitations with email notifications

**Reliability:**
- Integration test suite against a test database (the harness is in `tests/api_test.go`, it skips without `TEST_DATABASE_URL`)
- Health check with DB ping and `depends_on: condition: service_healthy` in docker-compose
- Structured error monitoring (Sentry)

**Security:**
- Refresh token rotation + short-lived access tokens (15 min)
- Rate limiting on auth endpoints (gin-contrib/ratelimit)
- CSRF protection for cookie-based auth

**Shortcuts taken:**
- The `projectMembers` list in `ProjectDetailPage` reconstructs user names from assignee IDs in tasks — a proper `/projects/:id/members` endpoint would return full user objects
- The `confirm()` dialog for task deletion is a browser native dialog; a proper destructive-action dialog would be better UX
