INSERT INTO users (id, name, email, password)
VALUES (
  gen_random_uuid(),
  'Test User',
  'test@example.com',
  '$2a$12$FM5OgnDNFgouF/o.7qFkgOjB5oLLfKdDNupovTpfJIL8SHB0MVJb6'
);