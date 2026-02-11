## Description

<!-- Provide a clear description of what this PR does and why it's needed -->

## Type of change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🔧 Configuration change
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement

## Changes made

<!-- Detailed list of changes -->

- Change 1
- Change 2
- Change 3

## Motivation and context

<!-- Why is this change necessary? What problem does it solve? -->

## How has this been tested?

<!-- Describe the tests you ran to verify your changes -->

- [ ] Tested locally with `npm run dev`
- [ ] Tested production build with `npm run build && npm run start`
- [ ] Manual testing in browser
- [ ] Tested authentication flows (if applicable)
- [ ] Tested with different user roles (if applicable)
- [ ] Tested edge cases

**Test Configuration:**
- **Node version:**
- **Browser:**
- **OS:**

## Screenshots / Videos

<!-- If applicable, add screenshots or videos demonstrating the changes -->

**Before:**

**After:**

## Database changes

<!-- If this PR includes database migrations -->

- [ ] New migrations added to `supabase/migrations/`
- [ ] Migrations tested locally
- [ ] Migration is idempotent (can be run multiple times safely)
- [ ] Rollback strategy documented

## Breaking changes

<!-- If this introduces breaking changes, describe them and the migration path -->

None / Describe breaking changes here

## Checklist

### Code quality
- [ ] Code follows the project's style guidelines
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run build` succeeds
- [ ] Self-review of my code completed
- [ ] Code is well-commented, particularly in complex areas

### Security
- [ ] No secrets, API keys, or credentials committed
- [ ] Sensitive data is properly sanitized
- [ ] Authentication/authorization checks are in place (if applicable)
- [ ] Input validation is implemented (if applicable)

### Documentation
- [ ] Code-level documentation added/updated
- [ ] README updated (if needed)
- [ ] API documentation updated (if API changes)
- [ ] Migration guide provided (if breaking changes)
- [ ] Relevant docs updated ([AUTH.md](../AUTH.md), [OVERVIEW.md](../docs/OVERVIEW.md), etc.)

### Dependencies
- [ ] New dependencies are justified and documented
- [ ] No unnecessary dependencies added
- [ ] Package versions are pinned appropriately

## Performance impact

<!-- Does this change affect performance? -->

- [ ] No performance impact
- [ ] Performance improved
- [ ] Potential performance impact (explained below)

## Related issues

<!-- Link related issues using keywords like Fixes, Closes, Resolves -->

Fixes #(issue)
Relates to #(issue)

## Additional notes

<!-- Any additional information that reviewers should know -->

---

## For reviewers

**Review focus areas:**
- [ ] Code quality and maintainability
- [ ] Security considerations
- [ ] Performance implications
- [ ] Edge cases handled
- [ ] Documentation completeness

**Deployment notes:**
<!-- Any special considerations for deployment -->
