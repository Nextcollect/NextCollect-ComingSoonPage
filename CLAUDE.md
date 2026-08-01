# CLAUDE.md — NextCollect Coming-Soon Page

Guidance for AI assistants working in this repository. Read
[`docs/DECISIONS.md`](docs/DECISIONS.md) before implementing anything — several decisions look
wrong or over-built from the code alone, and the reasoning is not recoverable from the codebase.

---

## DO NOT — read this first

1. **Do not create an anon-callable RPC to return a signup position.** A
   `my_position(p_email)` function is an email-enumeration oracle. Position comes from the
   `send-confirmation-email` edge function only. See D-001.
2. **Do not use in-memory / TTL counters for rate limiting.** Edge functions run on ephemeral,
   horizontally-scaled Deno isolates — counters are not shared, so an attacker gets a fresh
   bucket per isolate. Use the Postgres throttle table. See D-003.
3. **Do not store raw IP addresses.** Salted hash + purge past the window. The per-email
   dimension is personal data too. See D-003 / D-005.
4. **Do not delete a migration that has already been applied to the remote.** It desyncs the
   `schema_migrations` ledger permanently. Reverse it with a new forward migration. See D-007.
5. **Do not touch the database before the subscriber export exists.** Hard gate. See D-008.
6. **Do not upgrade to Next 15.x.** It is Maintenance LTS ending 21 Oct 2026. Target Next
   16.2.x + React 19. See D-004.
7. **Do not mix the framework upgrade into the security change set.** Separate branch, separate
   PR, cut after the security fixes merge.
8. **Do not edit the space-prefixed i18n files** (`app/i18n/ de.json`, ` es.json`, ` fr.json`,
   ` it.json` — note the leading space). They are dead, unimported, and hold older, differently
   worded translations. **Delete them**; the live files have no leading space.
9. **Do not recreate `app/lib/supabase.js` or `app/lib/validation.js`.** They were deleted as
   dead duplicates. The live modules are `app/components/Hero/supabase.js` and
   `app/components/Hero/validation.js`.
10. **Do not commit to `main`.** Work happens on `resume-audit` or a branch cut from it.
11. **Do not print secret values.** Variable names only, in any output or commit.
12. **Do not act on D-009 (`.env` in git history).** It is OPEN, not decided. Do not rotate keys
    or rewrite history until the owner decides.
13. **Do not drop the anon RLS policies without first confirming RLS is enabled** on
    `nextcollect_registration_records` (`SELECT relrowsecurity FROM pg_class WHERE relname='...'`).
    If RLS is off, policies are inert and dropping them accomplishes nothing. See D-002.

---

## What this project is

A single-page, six-language "coming soon" email-capture site.

- **Next.js 14** (App Router), **React 18**, plain **JSX** — there is no TypeScript in the app
  (the root `tsconfig.json` is Bolt/Vite residue and references two files that do not exist).
- **CSS Modules** + a design-token system in `app/styles/tokens.css`. No Tailwind.
- **Supabase** — Postgres + one Deno edge function. **There is no auth.** No login, no user
  identity; the browser holds only the public anon key. Anything about "auth flows" does not
  apply here.
- **Resend** — transactional confirmation email, sent from the edge function.
- **Vercel** — hosting.
- Package manager: **npm** (`package-lock.json`, lockfileVersion 3).

## Architecture that matters

The **edge function `supabase/functions/send-confirmation-email/index.ts` is (or is becoming)
the trusted server-side path.** Under the current remediation it owns the insert, the position
lookup, validation, rate limiting, and the email send. The browser's anon key should end up with
**no** direct read or write access to `nextcollect_registration_records`.

**Table:** `nextcollect_registration_records` — `id uuid` PK, `email text UNIQUE NOT NULL`,
`country text NOT NULL`, `created_at timestamptz`, `registration_position integer` (sequence
default). The position sequence increments on failed inserts too, so positions have gaps and are
not a true "Nth signup" count.

**Known duplication to keep in sync:** the milestone thresholds exist in two places —
`app/components/Hero/index.jsx:21` and `supabase/functions/send-confirmation-email/index.ts:104`.
Both files carry comments acknowledging it. Change one, change the other.

## Environment variables — where each one lives

Never print values. Names only.

| Name | Lives in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next `.env` + Vercel | Bundled into the browser by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next `.env` + Vercel | Public by design — never a security boundary |
| `SUPABASE_URL` | Supabase secrets | Platform-injected in deployed functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets | **Never** in the Next `.env`, never `NEXT_PUBLIC_*` |
| `RESEND_API_KEY` | Supabase secrets | **Currently also sits in the Next `.env` — remove it there.** The Next app never reads it |
| `ALLOW_LOCAL_ORIGIN` | Supabase secrets (local dev) | Set `true` to allow `http://localhost:3000` past the origin allowlist |

There is **no `.env.example`** — worth adding, names only.

## Running it

```bash
npm ci
npm run dev            # http://localhost:3000
npm run build          # verify before trusting anything
```

- **`.next/` is stale** — it predates the current source, so the committed work has never been
  built. Always rebuild before drawing conclusions.
- Edge function locally: `supabase functions serve send-confirmation-email` with
  `ALLOW_LOCAL_ORIGIN=true`, otherwise localhost is rejected with a 403 and signup email
  silently fails.
- Migrations live in `supabase/migrations/`. The Supabase CLI is linked to project
  `nofzyhxjpsikdhbcpfuo`; DB commands need `SUPABASE_DB_PASSWORD`.

**There is no lint, test, or typecheck script.** `package.json` has only `dev`, `build`, `start`,
and no ESLint config exists anywhere. Adding `eslint-config-next` plus smoke tests is planned
work — do not assume any safety net currently exists.

## Conventions

- **i18n:** `t('some.key') || 'English fallback'`. `t()` returns `""` for a missing key, so the
  `||` fallback fires. Locale is stored uppercase in state (`"EN"`, `"NL"`) and lowercased to
  match filenames.
  **Invariant: all six live files (`en, nl, de, fr, es, it`) must carry an identical key set** —
  currently 33 keys each. Adding a key means adding it to all six.
- **Styling:** use tokens from `app/styles/tokens.css` (`--space-*`, `--radius-*`, `--color-*`).
  A real system exists; the build has drifted off it in places. Prefer extending a token over
  adding a hex literal. Do **not** build out breakpoint/elevation/motion token systems — out of
  scope for a one-page site (D-006).
- **Images:** `next/image` everywhere in `app/`. Raw `<img>` is correct **only** inside the email
  HTML template, since email clients require it.
- **Copy in components** is duplicated between the `t()` fallback and `en.json`. Change both.

## Current state

- Branch **`resume-audit`**. Rollback point: commit **`8ee91f0`** (WIP checkpoint of partially
  implemented prior-audit work). Code rollback does **not** undo database changes.
- Remediation is sequenced in phases A–I; Phase A (verifying live Supabase/Resend/Vercel state)
  gates the severity of several security findings.
- `main` is untouched and must stay that way until the work is reviewed.
