-- Fix invalid bcrypt hash in seed user with a real bcrypt hash for "password123" (cost=12)
UPDATE users
SET password = '$2a$12$FM5OgnDNFgouF/o.7qFkgOjB5oLLfKdDNupovTpfJIL8SHB0MVJb6'
WHERE email = 'test@example.com';
