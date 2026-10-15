# Backend

This folder owns server-side application code and database assets.

- `src/actions/` — server actions called by frontend forms
- `src/lib/db.ts` — development/test database adapter
- `src/lib/sql.ts` — SQL statement parsing helpers
- `src/lib/tracking.ts` — public tracking projection and lookup logic
- `src/lib/types.ts` — database and public tracking contracts
- `supabase/migrations/` — ordered PostgreSQL migrations
- `supabase/seed.sql` — fictional local/test seed data

Keep secrets in environment variables. Run project commands from the repository
root so frontend and backend checks execute together.
