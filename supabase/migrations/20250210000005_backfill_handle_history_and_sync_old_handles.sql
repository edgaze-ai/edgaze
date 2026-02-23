-- Backfill handle_history so /profile/arjunkuttikkat1 redirects to current profile.
-- Then sync prompts/workflows that still have owner_handle = 'arjunkuttikkat1' to that profile's current handle/name.
-- old_handle is stored lowercase to match redirect lookup.

INSERT INTO handle_history (user_id, old_handle, created_at)
SELECT p.id, 'arjunkuttikkat1', now()
FROM profiles p
WHERE p.handle = 'arjun_kuttikkat'
  AND NOT EXISTS (SELECT 1 FROM handle_history h WHERE h.user_id = p.id AND h.old_handle = 'arjunkuttikkat1')
LIMIT 1;

-- Sync prompts that still have the old handle (including non-UUID owner_id rows skipped by previous migration)
UPDATE prompts p
SET owner_handle = pr.handle, owner_name = COALESCE(pr.full_name, p.owner_name)
FROM profiles pr
WHERE pr.handle = 'arjun_kuttikkat'
  AND lower(trim(p.owner_handle)) = 'arjunkuttikkat1';

-- Sync workflows the same way
UPDATE workflows w
SET owner_handle = pr.handle, owner_name = COALESCE(pr.full_name, w.owner_name)
FROM profiles pr
WHERE pr.handle = 'arjun_kuttikkat'
  AND lower(trim(w.owner_handle)) = 'arjunkuttikkat1';
