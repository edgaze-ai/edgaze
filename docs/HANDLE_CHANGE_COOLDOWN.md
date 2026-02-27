# Handle Change Cooldown System

## Overview

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

The handle change cooldown system restricts users from changing their profile handle more than once every 60 days (2 months). This feature helps maintain consistency, prevents confusion among followers, and protects brand identity.

## Features

### 1. **60-Day Cooldown Period**
- Users can change their handle once every 60 days
- After a handle change, the system tracks the timestamp and prevents further changes until the cooldown expires
- Clear messaging shows users how many days remain before they can change again

### 2. **Strict Warning Screens**
- Before any handle change, users see a comprehensive warning dialog explaining:
  - The 60-day cooldown that will be enforced
  - URL changes that will occur
  - The need to update external links
  - Acknowledgment requirements

### 3. **Cooldown Status Tracking**
- Users see their handle change status in the settings page
- A prominent banner displays when the handle is locked
- Shows the last change date and when editing will be available again
- Edit button is disabled during cooldown with a clear tooltip

### 4. **Automatic Re-enabling**
- The system automatically checks cooldown status
- No manual intervention required
- Users can change their handle immediately once 60 days have passed

## Technical Implementation

### Database Changes

#### New Column: `handle_last_changed_at`
```sql
ALTER TABLE public.profiles
ADD COLUMN handle_last_changed_at timestamp with time zone;
```

This column tracks when the user last changed their handle. It's set to `NULL` for users who have never changed their handle or for existing users (allowing them one free change).

#### New Function: `can_change_handle(uuid)`
```sql
CREATE OR REPLACE FUNCTION public.can_change_handle(user_id_input uuid)
RETURNS TABLE (
  can_change boolean,
  last_changed_at timestamp with time zone,
  next_allowed_at timestamp with time zone,
  days_remaining integer
)
```

This function:
- Takes a user ID as input
- Returns whether the user can change their handle
- Provides the last change date, next allowed date, and days remaining
- Returns `can_change: true` if the user has never changed their handle

### Backend Changes

#### New API Endpoint: `/api/profile/check-handle-change`
- **Method**: GET
- **Authentication**: Required
- **Response**:
  ```json
  {
    "canChange": true|false,
    "lastChangedAt": "2024-01-15T10:30:00Z" | null,
    "nextAllowedAt": "2024-03-15T10:30:00Z" | null,
    "daysRemaining": 0-60
  }
  ```

#### Updated: `/api/profile/cascade-handle`
Now updates the `handle_last_changed_at` timestamp whenever a handle changes:
```typescript
await admin
  .from("profiles")
  .update({ handle_last_changed_at: new Date().toISOString() })
  .eq("id", userId);
```

### Frontend Changes

#### New Components

1. **HandleChangeWarningDialog** (`src/components/settings/HandleChangeWarningDialog.tsx`)
   - Modal dialog shown before handle change
   - Displays current → new handle preview
   - Lists all warnings and consequences
   - Requires explicit confirmation
   - Shows processing state during save

2. **HandleCooldownBanner** (`src/components/settings/HandleCooldownBanner.tsx`)
   - Prominent banner shown when handle is locked
   - Displays cooldown status with days remaining
   - Shows last change date and next available date
   - Explains why the cooldown exists

#### Updated: Settings Page (`src/app/settings/page.tsx`)
- Fetches handle change status on load
- Shows cooldown banner when applicable
- Disables edit button during cooldown
- Shows warning dialog before handle change
- Validates cooldown before saving
- Refreshes status after successful change

## User Flow

### First-Time Handle Change
1. User clicks edit button on handle in settings
2. User enters new handle
3. User clicks "Save"
4. System validates handle availability
5. Warning dialog appears with all consequences
6. User confirms by clicking "Yes, Change Handle"
7. Handle is updated
8. Cooldown period begins (60 days)

### Subsequent Handle Change (Within Cooldown)
1. User visits settings page
2. Orange cooldown banner is displayed
3. Edit button is disabled with tooltip
4. If user somehow triggers edit, error message shows days remaining

### Handle Change (After Cooldown)
1. 60+ days have passed since last change
2. Cooldown banner is no longer shown
3. Edit button is enabled
4. User can change handle following the same flow as above

## Warning Messages

### Pre-Change Dialog Warnings
1. **60-Day Cooldown** (Red highlight)
   - Emphasizes the 2-month waiting period
   - Explains this prevents confusion

2. **URL Changes** (Amber highlight)
   - Notes that all profile and product URLs will update
   - Old links will redirect, but external updates recommended

3. **Acknowledgment Checklist**
   - Cannot change again for 60 days
   - Profile URL will update
   - All products will use new handle
   - Should update external links

### Cooldown Banner Messages
- Shows days remaining in a badge
- Explains the cooldown purpose
- Displays specific dates (last changed, available again)
- Educational tooltip about brand consistency

## Security & Data Integrity

### Database Level
- Function uses `SECURITY DEFINER` for consistent access
- Index on `handle_last_changed_at` for performance
- Comments document purpose and behavior

### Application Level
- Checks performed both client-side and server-side
- Double validation before database update
- Status refresh after successful change
- Error handling for network issues

### Migration Safety
- Uses `IF NOT EXISTS` for safe reruns
- Backfills existing users with `NULL` (allowing one free change)
- Adds comments for future maintainability

## Testing

### Manual Testing Checklist
- [ ] User with NULL `handle_last_changed_at` can change handle
- [ ] After change, cooldown banner appears
- [ ] Edit button is disabled during cooldown
- [ ] Warning dialog shows correct handle preview
- [ ] Handle change updates all products and workflows
- [ ] Old handle redirects to new handle
- [ ] Days remaining countdown is accurate
- [ ] Error messages display correctly
- [ ] Dialog can be cancelled
- [ ] After 60 days, user can change again

### Database Testing
```sql
-- Test 1: User who never changed handle
SELECT * FROM can_change_handle('USER_ID'::uuid);
-- Expected: can_change = true, all dates NULL

-- Test 2: User who changed 10 days ago
UPDATE profiles SET handle_last_changed_at = now() - INTERVAL '10 days' WHERE id = 'USER_ID'::uuid;
SELECT * FROM can_change_handle('USER_ID'::uuid);
-- Expected: can_change = false, days_remaining = 50

-- Test 3: User who changed 61 days ago
UPDATE profiles SET handle_last_changed_at = now() - INTERVAL '61 days' WHERE id = 'USER_ID'::uuid;
SELECT * FROM can_change_handle('USER_ID'::uuid);
-- Expected: can_change = true, days_remaining = 0
```

## Future Enhancements

### Potential Improvements
1. **Admin Override**: Allow admins to bypass cooldown for legitimate cases
2. **Notification**: Email users when cooldown expires
3. **History View**: Show all previous handles with change dates
4. **Early Change Tokens**: Allow users to earn/purchase early change tokens
5. **Pro Plan Benefit**: Reduce cooldown to 30 days for Pro users

### Analytics to Track
- Handle change frequency
- Time between changes
- Cooldown block attempts
- Warning dialog abandonment rate

## Troubleshooting

### Issue: Cooldown not showing
**Solution**: Check that `handle_last_changed_at` is set in database and API is returning correct status

### Issue: User stuck in cooldown
**Solution**: Verify date calculation in `can_change_handle` function, ensure timezone handling is correct

### Issue: Edit button enabled during cooldown
**Solution**: Check that `handleChangeStatus` state is properly populated from API

### Issue: Migration failed
**Solution**: Check for existing column, function, or index conflicts. Migration is safe to rerun.

## Files Changed

### Database
- `supabase/migrations/20250210000003_handle_change_cooldown.sql`

### Backend
- `src/app/api/profile/check-handle-change/route.ts` (new)
- `src/app/api/profile/cascade-handle/route.ts` (updated)

### Frontend
- `src/components/settings/HandleChangeWarningDialog.tsx` (new)
- `src/components/settings/HandleCooldownBanner.tsx` (new)
- `src/app/settings/page.tsx` (updated)
- `src/components/auth/AuthContext.tsx` (updated types)

### Documentation
- `docs/HANDLE_CHANGE_COOLDOWN.md` (this file)

## Deployment Notes

1. Apply database migration first: `20250210000003_handle_change_cooldown.sql`
2. Deploy backend changes (API routes)
3. Deploy frontend changes
4. No downtime required - existing users will have NULL `handle_last_changed_at`
5. First handle change for existing users will start their cooldown

## Support

For questions or issues related to this feature, contact the development team or refer to:
- Database schema documentation
- API documentation
- Component style guide
