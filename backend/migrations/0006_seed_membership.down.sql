-- Remove backfilled memberships (only those matching owner → admin)
DELETE FROM project_members pm
USING projects p
WHERE pm.project_id = p.id
  AND pm.user_id = p.owner_id
  AND pm.role = 'admin';
