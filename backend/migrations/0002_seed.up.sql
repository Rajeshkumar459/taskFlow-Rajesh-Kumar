INSERT INTO users (id, name, email, password)
VALUES (
  gen_random_uuid(),
  'Test User',
  'test@example.com',
  '$2a$12$examplehash'
);