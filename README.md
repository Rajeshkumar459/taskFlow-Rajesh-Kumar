# TaskFlow

A task management system with authentication, projects, and tasks — built with Spring Boot, React, and PostgreSQL.

---

## 1. Overview

TaskFlow lets users register, log in, create projects, add tasks to those projects, and assign tasks to themselves or other project members. Projects support a member system with admin and member roles.

**Tech Stack:**

| Layer | Technology |
|---|---|
| Backend API | Java 21 · Spring Boot 3.3 · Spring Data JPA · Spring Security |
| Frontend | React 19 · TypeScript · Material UI v7 · React Router v7 |
| Database | PostgreSQL 16 |
| Migrations | Flyway (runs automatically on startup) |
| Auth | jjwt 0.12 · HMAC-SHA256 · 24h expiry |
| Container | Docker Compose · multi-stage Dockerfile |
| Tests | JUnit 5 · Spring MockMvc · Vitest · Testing Library |

**Bonus features implemented:**
- Kanban board with drag-and-drop ([@dnd-kit](https://dndkit.com/))
- Real-time task updates via SSE (Server-Sent Events)
- Dark mode toggle that persists across sessions
- Project member management with admin/member roles

---

## 2. Architecture Decisions

**Spring Boot + Spring Data JPA**: Spring Boot provides a production-ready application context with auto-configuration. Spring Data JPA with Hibernate handles persistence, letting the schema remain the source of truth while Flyway manages migrations. JPA entities map directly to the PostgreSQL schema with no SQL duplication.

**JWT in Authorization header**: Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`. The 24h expiry is enforced server-side. For SSE connections (where `EventSource` cannot send custom headers), the token is also accepted via a `?token=` query parameter. The JWT secret is env-only — never committed.

**Spring Security with stateless JWT filter**: `JwtAuthFilter` (`OncePerRequestFilter`) reads the bearer token, validates it, and sets a `UUID` principal in the `SecurityContext`. All protected endpoints receive the authenticated user ID via `@AuthenticationPrincipal UUID userId`.

**Jackson SNAKE_CASE naming strategy**: All JSON field names use snake_case (`created_at`, `project_id`, etc.) to match the frontend and the Go-era API contract exactly. Configured globally via `spring.jackson.property-naming-strategy: SNAKE_CASE`.

**SseEmitter broker for real-time updates**: A `@Component` `SseBroker` holds a `ConcurrentHashMap<UUID, CopyOnWriteArrayList<SseEmitter>>` keyed by project ID. On any task mutation, the service calls `sseBroker.publish(projectId, eventType, data)` which fans out to all connected clients. No external dependency; acceptable for single-instance scale.

**MUI v7**: Provides a polished, accessible component library out of the box. Combined with a custom theme it avoids bikeshedding on CSS while producing professional results.

**Optimistic UI for task status**: Clicking the status chip updates local state immediately (feels instant), calls the API in the background, and reverts on failure.

**Project members**: Projects have an explicit `project_members` table with a `role` column (`admin` / `member`). The project owner is always an admin. Only members see a project in their list, and only admins can delete tasks or change project settings.

**Migration design**: Six Flyway migrations keep the schema and seed data cleanly separated:

| # | File | Purpose |
|---|---|---|
| V1 | `init` | `users` table |
| V2 | `seed` | Test user with a real bcrypt cost-12 hash |
| V3 | `projects_tasks` | `projects` and `tasks` tables with indexes |
| V4 | `seed_data` | Demo Project + 3 seeded tasks (todo / in_progress / done) |
| V5 | `project_members` | `project_members` join table with `role` column and index |
| V6 | `seed_membership` | Backfills existing project owners as admin members |

Flyway's `flyway_schema_history` table ensures each migration runs exactly once. Migrations run automatically on Spring Boot startup — no manual steps needed.

**What was intentionally left out:**
- Pagination on list endpoints — non-critical for the scope; the query layer is ready for it
- Refresh token rotation — 24h access tokens are sufficient for this scope
- Email notifications for member invitations

---

## 3. Running Locally

Requires only Docker Desktop.

```bash
git clone <repo-url>
cd taskflow-rajesh-kumar

docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080

The first build downloads Maven dependencies and npm packages (~5–6 min). Subsequent starts are fast (layers are cached).

Flyway migrations run automatically when the backend starts. No manual migration steps needed.

---

## 4. Running Tests

Tests run sequentially — frontend first, then backend — using the existing `postgres` service.

```bash
docker compose up frontend-test backend-test
```

Or run them individually:

```bash
# Frontend unit/component tests (Vitest + Testing Library)
docker compose run --rm frontend-test

# Backend integration tests (JUnit 5 + Spring MockMvc)
docker compose run --rm backend-test
```

**Frontend tests** (86 tests): Component tests for auth forms, task dialogs, project cards, filter bar, and API client.

**Backend tests** (45 tests): Full HTTP integration tests against a real PostgreSQL database via Spring MockMvc.

| Suite | Tests |
|---|---|
| `AuthControllerTest` | 12 — register, login, validation, protected route |
| `ProjectControllerTest` | 10 — CRUD, member access control, stats |
| `TaskControllerTest` | 15 — CRUD, defaults, validation, filters, due dates |
| `MemberControllerTest` | 8 — add/remove, role promotion, last-admin protection |

> **Note:** Backend tests use the same `postgres` service. Run `docker compose down` between test runs to clear test data, or they will accumulate (tests use timestamp-seeded unique emails so they won't collide across runs).

---

## 5. Test Credentials

A seed user is created automatically by Flyway:

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
| GET | `/projects` | List projects user is a member of |
| POST | `/projects` | Create project (caller becomes admin) |
| GET | `/projects/:id` | Project details + tasks + members |
| PATCH | `/projects/:id` | Update name/description (admin only) |
| DELETE | `/projects/:id` | Delete project + tasks (admin only) |
| GET | `/projects/:id/stats` | Task counts by status and by assignee |
| GET | `/projects/:id/events` | SSE stream — real-time task mutations |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks` | List tasks; supports `?status=` and `?assignee=unassigned` |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/tasks/:id` | Update title, description, status, priority, assignee, due_date |
| DELETE | `/tasks/:id` | Delete task (project admin only) |

### Members

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/members` | List project members |
| POST | `/projects/:id/members` | Add member (admin only) |
| PATCH | `/projects/:id/members/:userId` | Update member role (admin only) |
| DELETE | `/projects/:id/members/:userId` | Remove member (admin only) |

**Error format:**
```json
{ "error": "message" }
```
**Validation error format:**
```json
{ "error": "validation failed", "fields": { "email": "is already taken" } }
```

---

## 7. Trade-offs and Reasoning

### JWT in localStorage instead of httpOnly cookies

**Decision:** Access tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`.

**Trade-off:** `localStorage` is readable by JavaScript, making it vulnerable to XSS. `httpOnly` cookies are immune to XSS because the browser never exposes them to JavaScript.

**Why we chose this:** Bearer tokens are the natural fit for REST APIs consumed by SPAs — no CORS preflight complications, no `SameSite` edge cases, and no CSRF token infrastructure needed. The practical XSS risk is low when a Content Security Policy is set. A production hardening step would be to move to `httpOnly` cookies with `SameSite=Strict`.

---

### In-memory SSE broker instead of Redis pub/sub

**Decision:** Real-time event fan-out is handled by an in-process `SseBroker` component that holds `SseEmitter` lists per project.

**Trade-off:** Works correctly for a single server instance. Horizontal scaling across multiple pods would require an external message bus (Redis pub/sub) so events published to one pod reach clients connected to another.

**Why we chose this:** Redis adds an operational dependency for a feature that works perfectly at single-instance scale. `SseBroker` sits behind a narrow interface (`publish(projectId, eventType, data)` / `subscribe(projectId)`), so replacing the backing implementation with Redis is an isolated change that doesn't touch any controller code.

---

### No refresh token rotation — 24-hour access tokens only

**Decision:** A single JWT is issued at login with a 24-hour expiry. There is no `/auth/refresh` endpoint and no token blacklist.

**Trade-off:** If a token is leaked it remains valid for up to 24 hours with no revocation mechanism.

**Why we chose this:** Refresh token rotation with blacklisting adds meaningful complexity — an additional DB table, a clock-skew grace window, and logout-everywhere logic. For a task management tool with a controlled attack surface, 24-hour tokens are a deliberate simplification. The fix is additive: a `refresh_tokens` table and two endpoints without changing any existing auth code.

---

### Flat task list without pagination

**Decision:** `GET /projects/:id/tasks` returns all tasks in a single response.

**Trade-off:** Response time and memory grow linearly with task count. Very large projects will be slow.

**Why we chose this:** Tasks are indexed on `project_id`, so the query is fast at any realistic project size. The filter parameters (`?status=` and `?assignee=`) already reduce payload size for the most common access patterns. Cursor-based pagination would require frontend changes for marginal benefit at this scale.

---

### Within-column task order is not persisted

**Decision:** Dragging tasks within a Kanban column reorders them visually, but the order resets on the next data load.

**Trade-off:** Users cannot create a persistent custom task order.

**Why we chose this:** Persisting arbitrary sort order requires either a floating-point `rank` field (which requires periodic rebalancing) or a linked-list approach (which makes reordering a multi-row transaction). Either adds schema complexity, a dedicated reorder endpoint, and conflict resolution for concurrent drags. The default sort by priority then due date is meaningful and consistent.
