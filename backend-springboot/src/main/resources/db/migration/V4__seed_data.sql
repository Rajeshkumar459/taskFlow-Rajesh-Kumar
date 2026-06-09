-- Seed project owned by the test user
INSERT INTO projects (id, name, description, owner_id)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Demo Project',
  'A sample project for testing TaskFlow features',
  id
FROM users WHERE email = 'test@example.com';

-- Task 1: done
INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id)
SELECT
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'Setup project structure',
  'Initialize the repository, toolchain, and Docker configuration',
  'done',
  'high',
  'a0000000-0000-0000-0000-000000000001'::uuid,
  u.id
FROM users u WHERE u.email = 'test@example.com';

-- Task 2: in_progress
INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id)
SELECT
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'Implement authentication',
  'JWT-based login and registration endpoints',
  'in_progress',
  'high',
  'a0000000-0000-0000-0000-000000000001'::uuid,
  u.id
FROM users u WHERE u.email = 'test@example.com';

-- Task 3: todo (no assignee)
INSERT INTO tasks (id, title, description, status, priority, project_id)
VALUES (
  'b0000000-0000-0000-0000-000000000003'::uuid,
  'Write API documentation',
  'Document all REST endpoints with request/response examples',
  'todo',
  'low',
  'a0000000-0000-0000-0000-000000000001'::uuid
);
