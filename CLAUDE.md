# Working with Oat on Pizza Damac

Owner: Oat (not a programmer). Reply in simple Thai, explain what changed and why in plain words.

## How Oat wants Claude to work
- **Tell Oat the plan first, then do it after Oat agrees.** Say clearly what will change
  (DB changes, merges, releases, deploys) and ask one short question before acting.
- **When blocked, do not hand manual steps to Oat as the answer.** If Claude cannot do something
  (no permission, missing tool, etc.), say what is missing and propose what Claude can build or set up
  so Claude can do it next time (example: tags could not be pushed from a session, so
  `.github/workflows/release.yml` was added and Claude now creates releases by running it).
  Give manual steps only as a fallback, after offering that option.
- Every change gets a version bump + a detailed Thai `CHANGELOG.md` entry
  (อาการ / สาเหตุ / แก้, commit hashes, DB migration names) — see `VERSIONING.md`.
  Bump `package.json` "version" in the same PR; merging it to `main` makes
  `.github/workflows/release.yml` create the GitHub Release + tag automatically.
  Back-fill or re-run: trigger the workflow (`workflow_dispatch`) with `version` + `ref`.

## Deploy
- `main` auto-deploys to Google Cloud Run service `pizza-damac-delivery-v2` (asia-southeast1) in ~3–5 min.
  Services `pizza-damac` and `pizza-damac-delivery` are old and unused.
- Is it live? This session cannot open pizzadamac.com (network policy). Read the latest run of
  `.github/workflows/verify-deploy.yml` (runs on every push to main; green = new revision serving the
  package.json version, red = not live after 20 min). For an on-demand check, trigger it with `workflow_dispatch`.
- Server secrets live in Cloud Run env vars (incl. `SUPABASE_SERVICE_ROLE_KEY`), never in code.

## Database (Supabase project `hecmhlzgihjatutibwca`)
- Any DB change: apply as a migration, test in a rolled-back transaction, and save the SQL in
  `sql/<date>_v<appVersion>_<topic>.sql`. Files in `sql/` are records of what is already live — never re-run them.
- Apply DB changes BEFORE merging app code that depends on them (e.g. new columns the app inserts).
- Functions `returns setof customers` / `setof orders` must list every table column; adding a column
  means updating `loyalty_login`, `loyalty_lookup`, `track_orders` in the same migration.
- The Cloud Run server uses the service role: treat `auth.jwt()->>'role' = 'service_role'` as staff.

## Checks before pushing
- `npx vite build` must pass; `npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=/tmp/s.cjs` for server changes.
- `tsc --noEmit` has many old errors in big view files; only make sure the files you changed add none.
