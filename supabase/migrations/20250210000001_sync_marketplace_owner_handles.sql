-- One-time sync: set workflows.owner_handle and prompts.owner_handle (and owner_name)
-- from profiles so marketplace and product pages show current handles after manual DB updates.
-- Safe to run multiple times (only updates rows where value differs).

UPDATE workflows w
SET
  owner_handle = p.handle,
  owner_name = COALESCE(p.full_name, w.owner_name)
FROM profiles p
WHERE p.id = w.owner_id
  AND (w.owner_handle IS DISTINCT FROM p.handle OR w.owner_name IS DISTINCT FROM COALESCE(p.full_name, w.owner_name));

UPDATE prompts p
SET
  owner_handle = pr.handle,
  owner_name = COALESCE(pr.full_name, p.owner_name)
FROM profiles pr
WHERE pr.id::text = p.owner_id
  AND p.owner_id IS NOT NULL
  AND p.owner_id ~ '^[0-9a-fA-F-]{36}$'
  AND (p.owner_handle IS DISTINCT FROM pr.handle OR p.owner_name IS DISTINCT FROM COALESCE(pr.full_name, p.owner_name));
