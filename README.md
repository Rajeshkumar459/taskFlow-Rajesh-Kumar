# TaskFlow

A task management system with authentication, projects, and tasks — built with Go, React, and PostgreSQL.

---

## 1. Overview

TaskFlow lets users register, log in, create projects, add tasks to those projects, and assign tasks to themselves or other project members. Projects support a member system with admin and member roles.

**Tech Stack:**

| Layer | Technology |
|---|---|
| Backend API | Go 1.23 · Gin · pgx v5 · golang-jwt |
| Frontend | React 19 · TypeScript · Material UI v7 · React Router v7 |
| Database | PostgreSQL 16 |
| Migrations | golang-migrate |
| Container | Docker Compose · multi-stage Dockerfile |
| Tests | Go stdlib `testing` · Vitest · Testing Library |

**Bonus features implemented:**
- Kanban board with drag-and-drop ([@dnd-kit](https://dndkit.com/))
- Real-time task updates via SSE (Server-Sent Events)
- Dark mode toggle that persists across sessions
- Project member management with admin/member roles

---

## 2. Architecture Decisions

**Go + Gin**: Gin is the most widely adopted Go HTTP framework with excellent middleware support and a predictable handler signature. The project uses a layered structure: `config` → `db` → `api/handlers` → `router` → `main.go`.

**pgx/v5 directly (no ORM)**: Using pgx with parameterised SQL gives full visibility into queries, avoids N+1 issues, and keeps the schema the source of truth. All SQL lives in the `db` package and is intentionally readable.

**JWT in Authorization header**: Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`. This is the standard approach for SPAs. The 24h expiry is enforced server-side. The JWT secret is env-only — never committed.

**MUI v7**: Provides a polished, accessible component library out of the box. Combined with a custom theme it avoids bikeshedding on CSS while producing professional results.

**Optimistic UI for task status**: Clicking the status chip updates local state immediately (feels instant), calls the API in the background, and reverts on failure.

**Drag-and-drop with @dnd-kit**: Tasks can be dragged between Kanban columns to manage status.

**SSE broker for real-time updates**: A per-project SSE endpoint (`GET /projects/:id/events`) broadcasts task mutations to all connected clients in the same project. The broker is a lightweight in-memory fan-out with no external dependency; it is acceptable for a single-instance server. A Redis pub/sub layer would be needed for horizontal scaling.

**Dark mode with ThemeContext**: Theme preference is stored in `localStorage` and respects the OS `prefers-color-scheme` default. The entire MUI theme is regenerated via `useMemo` on mode toggle, keeping theme logic in one place.

**Project members**: Projects have an explicit `project_members` table with a `role` column (`admin` / `member`). The project owner is always an admin. The `/projects/:id/members` endpoint lets admins invite and remove members. Only members see a project in their list, and only admins can delete tasks or change project settings.

**Migration design**: Six numbered migrations keep the schema and seed data cleanly separated:

| # | File | Purpose |
|---|---|---|
| 0001 | `init` | `users` table |
| 0002 | `seed` | Test user with a real bcrypt cost-12 hash |
| 0003 | `projects_tasks` | `projects` and `tasks` tables with indexes |
| 0004 | `seed_data` | Demo Project + 3 seeded tasks (todo / in_progress / done) |
| 0005 | `project_members` | `project_members` join table with `role` column and index |
| 0006 | `seed_membership` | Backfills existing project owners as admin members |

Every migration has a corresponding `.down.sql`. golang-migrate's `schema_migrations` table ensures each runs exactly once.

**What was intentionally left out:**
- Pagination on list endpoints (`?page=&limit=`) — non-critical for the scope; the query layer is ready for it
- Refresh token rotation — 24h access tokens are sufficient for a take-home
- Email notifications for member invitations

---

## 3. Running Locally

Requires only Docker Desktop.

```bash
git clone https://github.com/Rajeshkumar459/TaskFlow
cd taskflow

cp .env.example .env

docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080

The first build downloads Go modules and npm packages (~5–6 min depending on user device). Subsequent starts are fast.

To run tests:

```bash
# Backend integration tests (require a running DB)
docker compose run --rm backend-test

# Frontend unit/component tests
docker compose run --rm frontend-test
```

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
| GET | `/projects` | List projects user is a member of or owns |
| POST | `/projects` | Create project (caller becomes admin) |
| GET | `/projects/:id` | Project details + tasks |
| PATCH | `/projects/:id` | Update name/description (admin only) |
| DELETE | `/projects/:id` | Delete project + tasks (admin only) |
| GET | `/projects/:id/stats` | Task counts by status and by assignee |
| GET | `/projects/:id/events` | SSE stream — real-time task mutations |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks` | List tasks; supports `?status=` and `?assignee=` |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/tasks/:id` | Update title, description, status, priority, assignee, due_date |
| DELETE | `/tasks/:id` | Delete task (project admin only) |

### Members

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/members` | List project members |
| POST | `/projects/:id/members` | Add member by email (admin only) |
| DELETE | `/projects/:id/members/:userId` | Remove member (admin only) |

**Error format:**
```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

---

## 7. Trade-offs and Reasoning

### JWT in localStorage instead of httpOnly cookies

**Decision:** Access tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`.

**Trade-off:** `localStorage` is readable by any JavaScript running on the page, making it vulnerable to XSS. `httpOnly` cookies are immune to XSS because the browser never exposes them to JavaScript.

**Why we chose this:** REST APIs consumed by SPAs are the natural fit for Bearer tokens — no CORS preflight complications, no `SameSite` edge cases, and no CSRF token infrastructure needed. The practical XSS risk is low when Content Security Policy is set correctly. A production hardening step would be to move to `httpOnly` cookies with a `SameSite=Strict` policy and add a CSRF token endpoint.

---

### In-memory SSE broker instead of Redis pub/sub

**Decision:** The real-time event fan-out is handled by an in-process Go struct that holds subscriber channels per project.

**Trade-off:** This works correctly for a single server instance. If you scale horizontally to two API containers, clients connected to different pods will not receive each other's events.

**Why we chose this:** Redis adds an operational dependency and several hundred lines of connection/reconnect logic for a feature that works perfectly at single-instance scale. The broker sits behind a narrow interface (`Publish(projectID, event)` / `Subscribe(projectID) chan Event`), so replacing the backing implementation with Redis pub/sub is an isolated change that doesn't touch any handler code.

---

### No refresh token rotation — 24-hour access tokens only

**Decision:** A single JWT is issued at login with a 24-hour expiry. There is no `/auth/refresh` endpoint and no token blacklist.

**Trade-off:** If a token is leaked it remains valid for up to 24 hours. There is no mechanism to revoke a live token without a server-side blacklist (which requires shared state across instances).

**Why we chose this:** Refresh token rotation with blacklisting adds meaningful backend complexity — an additional DB table, a clock-skew grace window, and logout-everywhere logic. For a task management tool where sessions are not long-lived and the attack surface is controlled, 24-hour tokens are a deliberate simplification. The fix is additive: add a `refresh_tokens` table and two endpoints without changing any existing auth code.

---

### Flat task list without pagination

**Decision:** `GET /projects/:id/tasks` returns all tasks for a project in a single response.

**Trade-off:** Response time and memory usage grow linearly with task count. A project with thousands of tasks will be slow.

**Why we chose this:** Tasks are indexed on `project_id`, so the query is fast at any realistic project size. Cursor-based pagination would require frontend changes (infinite scroll or a paginator component) for marginal benefit at this scale. The server-side filter parameters (`?status=` and `?assignee=`) already reduce payload size for the most common access patterns.

---

### Within-column task order is not persisted

**Decision:** Dragging tasks within a Kanban column reorders them visually, but the order is not saved to the database and resets on the next data load.

**Trade-off:** Users cannot create a persistent custom task order.

**Why we chose this:** Persisting arbitrary sort order requires either a floating-point `rank` field (which requires periodic rebalancing to avoid precision exhaustion) or a linked-list approach (which makes reordering a multi-row transaction). Either adds schema complexity, a dedicated reorder endpoint, and conflict resolution logic for concurrent drags from two users. The default sort by priority then due date is meaningful and consistent, which is more useful than an arbitrary manual order that would need to survive concurrent edits.

---