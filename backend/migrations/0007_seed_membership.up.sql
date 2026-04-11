-- Backfill: make every existing project owner an admin member of their own project
INSERT INTO project_members (project_id, user_id, role)
SELECT id, owner_id, 'admin'
FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;
