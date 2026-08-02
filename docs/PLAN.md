# NextCollect Coming-Soon Page — Audit & Remediation Plan

> **This file (`docs/PLAN.md`) is CANONICAL.** A copy exists in Claude Code's local plan
> storage (`~/.claude/plans/`) from the planning session; it is **superseded and must not be
> edited or read as authoritative**. Update this file only.
>
> **Status: Phase A (service verification) COMPLETE as of 2026-08-02.** Live state is now
> verified via read-only MCP against Supabase, Resend and Vercel, plus a production probe.
> No `UNVERIFIED` items remain. Not yet approved for execution.
> Branch `resume-audit`. Rollback point: commit `8ee91f0`.
> Decisions and rejected alternatives: [`DECISIONS.md`](DECISIONS.md). Guardrails: [`../CLAUDE.md`](../CLAUDE.md).

## ⚠ READ THIS FIRST — what this project actually is

**This is not a dormant site that needs a security audit. It is a site that has never worked in
production.**

The signup form — the only function this site has — has been failing for every real visitor since
at least 2026-03-10, because the deployed JavaScript points at a Supabase project that no longer
exists (D-012). Every signup attempt dies at DNS and shows the user a generic "There was an issue
with this entry." The audit's security findings are real and worth fixing, but they describe a
**machine that was never switched on**.

**This changes what "done" means.** Done is not "the security findings are closed." Done is **a
visitor can sign up and receive a confirmation email**, with the security work landed *before* that
path goes live. Order matters more than completeness here: the site must not be brought back up
until the read leak is closed, because right now it is broken-but-not-leaking and the naive fix
would make it working-and-leaking.

Read `DECISIONS.md` D-012 before touching anything, then the sequence in "C-ENV" below.

## Context

A Next.js 14 (App Router, JSX, CSS Modules) coming-soon page: a 6-language email-capture form
backed by Supabase (Postgres + one Deno edge function) sending a Resend confirmation email.
Scaffolded in Bolt.new, continued in Codex, hosted on Vercel.

Dormant, then partly worked on: commit `8ee91f0` is a WIP checkpoint that **partially implements
a prior (2026-03-12) audit** whose report no longer exists. This plan re-reviews everything with
fresh eyes, classifies that in-flight work, and sequences remediation. Goal: a professional,
production-ready launch page — **not maximum change**.

**The single most important finding of Phase A: the repository and production have diverged.**
Several fixes that exist in the repo were never deployed, and part of the live schema was never
expressed as a migration. Reading the code alone gives a materially wrong picture of production.

---

# Phase A — VERIFIED STATE (2026-08-02)

## Supabase

| Check | Result |
|---|---|
| RLS on `nextcollect_registration_records` | **`relrowsecurity = true`** — enabled. D-002's load-bearing assumption **CONFIRMED** |
| `public.count_estimate` exists? | **NO.** `pg_proc` returns zero rows; no `SECURITY DEFINER` functions exist in `public` at all |
| `count_estimate` via RPC | **HTTP 404** `PGRST202` — not in the schema cache |
| Live policies | `Allow public insert for registration` (INSERT, anon) `WITH CHECK (email IS NOT NULL AND email <> '' AND country IS NOT NULL AND country <> '')`; `Users can view own registration` (SELECT, anon) `USING (true)` |
| Anon table grants (`relacl`) | **`anon=arwdDxtm/postgres`** — INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN. **RLS is the only thing restricting anon** |
| Migration ledger | **`supabase_migrations` schema DOES NOT EXIST.** `list_migrations` returns `[]`. No migration has ever been applied via the CLI |
| Security advisors | Two `WARN`s only — lint 0026/0027: table visible in GraphQL because `anon`/`authenticated` can `SELECT`. **No mutable-`search_path` warning exists** |
| Table contents | **1 row.** `created_at` 2026-03-14, `registration_position` 6. A test signup (owner's own address, country Belgium) |
| Edge function | `send-confirmation-email`, version 3, ACTIVE, **`verify_jwt: true`**, deployed ~2026-03-10 |
| Edge function logs (24h) | **Empty** — no invocations |
| API logs (24h) | Infra health checks only; no signup traffic |

## Production probe (run after the B1 export, per D-008)

```
GET /rest/v1/nextcollect_registration_records?select=email,country,created_at,registration_position
    with the public anon key  →  HTTP 200, 1 row returned in full
POST /rest/v1/rpc/count_estimate  →  HTTP 404 (PGRST202)
```
**The read leak is live and exploitable with the key that ships in the browser bundle.**
UPDATE/DELETE are denied by RLS (no policies exist for those commands) despite anon holding
table-level grants for them.

## Resend — healthy

- Domain **`nxtcollect.com`: verified**, sending enabled, region `eu-west-1`, created 2026-03-10.
  **SPF/DKIM/DMARC are fine — D5 does NOT re-rank to #1.**
- **4 emails ever sent**, all 2026-03-10 → 2026-03-14, all to the owner's own two addresses.
- **1 of those 4 is `complained`** (marked as spam). Almost certainly owner testing, but it is a
  real complaint recorded against a domain with almost no positive sending history.
- Open tracking and click tracking are **off** — good for GDPR, keep it that way.

## Vercel

- Project `nextcollect-coming-soon-page`, framework nextjs, Node 24.x.
- Production deployment **READY**, from commit **`a38ec731`**, ~2026-03-10. Nothing since.
- Domains: `nxtcollect.com`, `www.nxtcollect.com`, plus `.vercel.app` aliases.
- **Preview deploys are NOT public** — `ssoProtection: enabled` / `all_except_custom_domains`.
  Password protection off, trusted IPs off. **This concern is resolved.**
- **`githubRepoVisibility: "public"`** — the GitHub repository is public. See D-009.
- **Env vars — VERIFIED 2026-08-02 via `vercel env ls` (names only). No critical finding.**
  Five vars, all present in Production / Preview / Development (full parity):
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`.
  **The only `NEXT_PUBLIC_*` vars are the Supabase URL and anon key — both intentionally public.
  No secret is browser-exposed.** Two cleanup items recorded (not acted on):
  - `RESEND_API_KEY` in Vercel is **unused** — grep of `app/` returns zero hits; the edge function
    reads its own copy from Supabase secrets. Duplicated live credential → **delete from Vercel**
    and from the local Next `.env`.
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are dead Bolt/Vite residue (same pair as in
    D-009's git-history finding) → **delete from Vercel**.

**Phase A is now fully closed — no open verification items remain.**

**Supabase secrets — VERIFIED present:** `RESEND_API_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. The C0 module-scope-client boot risk is therefore
cleared.

## Git

- **Local `main` is stale.** local `main` = `b3a428e`; **`origin/main` = `a38ec731`** (2 commits
  ahead: two image renames). Production runs `origin/main`.
- `resume-audit` branched from `b3a428e`, so it has **diverged**: 4 ahead / 2 behind `origin/main`.
- Verified benign: `public/img` trees are identical on both, merge-base is `b3a428e`, and
  `git merge-tree` reports **0 conflicts**. The local WIP re-did a rename `origin/main` had already
  done. **Fetch and rebase before opening any PR.**

---

# What Phase A changed

**Downgraded**
- **C1 `count_estimate` — CRITICAL → non-issue.** The function does not exist, was never applied,
  and the advisor warning it was written to silence does not exist either. It was solving a
  phantom. Action shrinks to deleting the migration file. **No remote `DROP` is needed.**
- **C5 INSERT validation — already correct in production.** Live policy carries the non-empty
  check from migration 2. The `WITH CHECK (true)` regression exists **only in the repo files**.

**Confirmed**
- **C2 read leak — live**, verified two independent ways (probe + advisor lint 0026). RLS is on,
  so dropping the policy will be meaningful. Note the *data* currently exposed is 1 test row, so
  today's exposure is negligible; the *defect* is fully live and would leak everything at launch.
- **C3 no rate limiting** — unchanged.

**New — not in the plan before Phase A**
- **C0 (new, now #1): production is running the OLD, pre-hardening edge function.**
- **Operational blocker: the migration ledger does not exist**, so the plan's assumed
  `supabase db push` deploy path is broken.
- **anon holds full table grants** — elevates the D-002 `REVOKE` from optional to recommended.
- **The GitHub repo is public** — a new input to D-009.
- **Local `main` is behind `origin/main`** — affects PR sequencing.

---

# Revised execution sequence

## Phase B — Pre-flight safety

**B1. Subscriber export — DONE** (owner, outside the repo). Gate satisfied; the production probe
above ran only after it. **Re-export if more signups arrive before Phase C.**
**B2. Rollback point** — `8ee91f0`. Code rollback does **not** undo DB changes.
**B3. NEW — baseline the migration ledger** (see C-OPS below) before any schema change.

## Phase C — Security must-fix

### C0 — **NEW, HIGHEST PRIORITY.** Deploy the hardened edge function

Production runs **version 3 from ~2026-03-10**, which is the *pre-hardening* code. Everything the
in-flight work fixed in the repo is **absent from production**:

| Defect (live in production) | Repo status |
|---|---|
| `Access-Control-Allow-Origin: "*"` — no origin allowlist | fixed in repo |
| No runtime input validation (a TypeScript `interface` enforces nothing at runtime) | fixed in repo |
| **`${registrationPosition}` interpolated raw into the email HTML** → HTML injection into outbound branded mail | fixed in repo |
| **No registered-email check → OPEN RELAY**: sends NextCollect-branded email to *any* address supplied | fixed in repo |
| `{{aboutUrl}}`, `{{instagramUrl}}`, `{{facebookUrl}}`, `{{tiktokUrl}}` + an 11-token hidden legacy block, all unresolved | fixed in repo |
| `details: result` / `details: error.message` leaked to the client | **still present in repo too — see C4** |

`verify_jwt: true` is **not** a mitigation: the anon key is a valid JWT, ships in the browser
bundle, and sits in a **public** GitHub repo. Anyone can `curl` this endpoint and have a verified
`nxtcollect.com` sender deliver branded mail to an arbitrary address — a phishing primitive that
also burns the domain's reputation.

**Action:** deploy the repo version. Per guardrail 14, **write/verify only — the owner runs
`supabase functions deploy send-confirmation-email`.** Effort XS (the code already exists).
Impact **critical**.

**Pre-deploy compatibility checks — VERIFIED 2026-08-02 against the deployed client (`a38ec731`):**

| Check | Result |
|---|---|
| Repo allowlist | `https://www.nxtcollect.com`, `https://nxtcollect.com`, plus `http://localhost:3000` only when `ALLOW_LOCAL_ORIGIN=true` |
| Real production origin | `nxtcollect.com` **307-redirects to** `https://www.nxtcollect.com` (HTTP 200). Browsers send `Origin: https://www.nxtcollect.com` — **covered**. Apex also covered |
| `*.vercel.app` aliases | **NOT in the allowlist → 403.** Not a real-user path (custom domains are canonical), but **signup email will fail silently if you test from a `.vercel.app` URL** |
| Does the row exist before the function is called? | **YES.** The deployed client inserts client-side with `.insert().select('registration_position').maybeSingle()` and only then calls the function. The registered-email existence check will pass |
| Request body shape | Client sends `{ email, registrationPosition }`; the hardened function reads exactly those two keys — **compatible** |
| Missing position | If `.select()` returns null, `registrationPosition` is dropped by `JSON.stringify` → parsed as `null` → generic "Founder" copy. **Degrades gracefully** |
| Methods / headers | Repo allows `POST, OPTIONS` + `Content-Type, Authorization, X-Client-Info, Apikey`; client sends POST with all three — **compatible** |

**⚠ The one genuine deploy risk:** the repo version adds a module-scope
`createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)`. If
either secret is missing, the isolate **fails to boot and every request 500s** — signup email
breaks completely rather than degrading. Both are normally auto-injected by the Supabase platform,
and `RESEND_API_KEY` is demonstrably set (past sends delivered), so this is expected to be fine —
but confirm before deploying.

**Still present in the repo version (C4):** `details: result` and `details: error.message` leak to
the client. Folding C4 in before deploying would avoid a second deploy.

### C-OPS — **NEW.** Baseline the migration ledger before any schema change

`supabase_migrations` does not exist; nothing has ever been pushed. Running `supabase db push`
now would attempt all six migrations against an already-populated schema. `CREATE POLICY` has no
`IF NOT EXISTS`, so it **would error and abort part-way**. The live schema also differs from the
repo (the INSERT policy), so the files are not a faithful description of production.

**Two costed options. Owner decides.**

#### Option A — `migration repair --status applied` on all six existing files

Mark each of the six as applied so the ledger is populated, then push only new migrations.

- **Effort:** XS — six commands.
- **Risk: HIGH, and the risk is dishonesty.** The ledger would assert that six files were applied
  when they never ran, and at least one **does not match production**: migration 5 declares
  `WITH CHECK (true)` while the live INSERT policy carries the non-empty check. Migrations 1–4 also
  reference `early_access_signups`, a table that no longer exists.
- **What goes wrong:** anyone building a local/staging/preview database from these migrations gets
  a **different database than production** — a permissive INSERT policy where production is strict.
  Tests pass locally, production behaves differently. A future `supabase db reset` would replace
  the real policy with the fictional one. Worst of all, the executing model reads migration 5,
  believes production is permissive, and reasons from a false premise.
- **Verdict:** this institutionalises exactly the repo/production drift that D-010 identifies as the
  root problem of this audit. **Not recommended.**

#### Option B — squash to one honest baseline *(owner's proposal — RECOMMENDED)*

Dump the live schema, write **one** baseline migration that reflects actual production, mark only
that one applied, and archive the six fictional files.

- **Effort:** S — roughly: `supabase db dump --schema public` → review and trim → write
  `supabase/migrations/<ts>_baseline_production.sql` → `supabase migration repair --status applied
  <ts>` → move the six into `supabase/migrations/_archive/` with a short README.
- **Risk: LOW.** The single file genuinely describes production, so a fresh environment reproduces
  reality. All later work becomes ordinary forward migrations.
- **What to watch:**
  - The dump will include Supabase-managed objects (extensions, `auth`/`storage` schemas). Restrict
    with `--schema public` and review before committing — a user migration should not try to own
    platform objects.
  - You lose the narrative history (why the table was renamed, why the position sequence exists).
    **Mitigate by archiving, not deleting**, the six files, with a README explaining they predate
    the ledger and were never applied.
  - Sequence it **first**: baseline captures production as-is, *then* C2's policy drops and the
    `REVOKE` land as a normal migration on top. Do not fold C2 into the baseline.
- **Verdict:** more work than Option A and the correct trade. It makes the files stop lying, which
  is the actual defect.

Until this is resolved, **no migration-based change can ship.** Impact **blocks all Phase C DB work**.

### C1 — Delete the `count_estimate` migration file  *(downgraded)*
Not applied, function absent, advisor warning absent. Per D-007's "not applied" path: **delete
`supabase/migrations/20260314223534_fix_count_estimate_search_path.sql`.** No remote action.
Effort XS. Impact: prevention only — it must never reach a database.

### C2 — Close the read leak via full edge-function relocation  *(confirmed live)*
Live SELECT policy is `USING (true)`; probe returned a full row with the anon key. RLS **is** on,
so the policy drop is meaningful. Approach unchanged (D-001/D-002): move insert + position into the
edge function, drop **both** anon policies.
- **`REVOKE ALL ... FROM anon` — SAME TIER as the policy drop, in the same change (owner-elevated).**
  `relacl` shows `anon=arwdDxtm`, i.e. **UPDATE, DELETE and TRUNCATE**. These are blocked today only
  because no RLS policy covers those commands — RLS is a single switch, and if it is ever toggled
  off (dashboard, debugging, a future migration) the public anon key can `TRUNCATE` the subscriber
  table. That is a live data-destruction exposure with no second layer, not defence-in-depth.
  ```sql
  REVOKE ALL ON nextcollect_registration_records FROM anon;
  REVOKE ALL ON nextcollect_registration_records FROM authenticated;  -- advisor lint 0027
  ```
  Safe: the edge function uses the service role. `authenticated` holds identical grants and this
  project has no auth at all.
- Effort M. Impact **critical** (defect + destruction exposure), low (today's data: 1 test row).

### C3 — Rate limiting (Postgres throttle table)  *(unchanged)*
Unchanged in design and rationale — see D-003. Note it now also protects the C0 open-relay path.
Effort S–M. Impact **high**.

### C4 — Stop internal-detail leakage and silent email failure  *(unchanged, present in both)*
`details: result` / `details: error.message` leak in **both** the repo and the deployed version.
Fold into the C0 deploy. Effort S. Impact high / med.

### C5 — Reconcile repo migration to production  *(re-scoped)*
Production already enforces the non-empty check; **the repo is what's wrong**. Fix migration 5's
`WITH CHECK (true)` so the files describe reality (part of C-OPS option 3). Moot for the live
policy, which C2 drops anyway. Effort XS. Impact low (correctness of the record).

## Phase D — EU launch conditions (GDPR)

Unchanged and still blocking — see D-005. **D5 email deliverability is VERIFIED HEALTHY**
(domain verified, sending enabled), so it does not re-rank. Two notes from Phase A:
- **1 spam complaint out of 4 sends.** Watch this; a `List-Unsubscribe` header (D3) is the standard
  mitigation and is already required.
- Resend open/click tracking is **off** — a genuine GDPR advantage. Keep it off.

D1 privacy policy · D2 consent/lawful basis · D3 unsubscribe · D4 deletion path. All six languages.

## Phase E — Correctness

- **E1.** Missing `public/img/og-image.png` (`layout.jsx:24,36`) → broken previews. XS.
- **E2.** Locale not persisted + `Navbar/index.jsx:26-33` overwrites it with `navigator.language`. S. **Real UX bug.**
- **E3.** Untranslated internal error `Hero/index.jsx:147`. XS.
- **E4.** `<html lang>` SSR-correct (`layout.jsx:46`). S.
- **E5.** **Prove it runs:** `.next` is stale. `npm ci && npm run build`. XS.
- **E6.** `tsconfig.json` references non-existent `tsconfig.app.json` / `tsconfig.node.json`. XS.
- **E7. NEW — fetch and rebase before any PR.** Verified 2026-08-02:
  ```
  local  main  = b3a428e   (stale)
  origin/main  = a38ec731  ← production runs this
  resume-audit = 4 ahead / 2 behind origin/main   (DIVERGED, not simply "ahead")
  merge-base   = b3a428e ;  git merge-tree → 0 conflicts
  ```
  The two `origin/main` commits are image renames that `8ee91f0` re-did independently; both
  branches end with identical `public/img` trees, so the merge is clean. **Run `git fetch origin`
  and rebase/merge `origin/main` before opening a PR** — do not reason from the stale local `main`
  ref. XS.

## Phase F — Structure / cleanup

F1 orphan space-prefixed i18n files · F2 Bolt residue · F3 unused assets + the 1.6 MB email image ·
F4 stale README · F5 de-dupe scroll logic + milestone thresholds · **F6 lint/tests (insisted on)** ·
F7 dead `SocialMedia` import in Hero. Unchanged.

## Phase G — Design coherence + accessibility

Unchanged. A system exists (`tokens.css`); the build drifted ~20% off it. **Finish it, don't found
a new one** (D-006).
**A11y (must-fix):** G1 `.submitButton` missing `:focus-visible` · G2 dropdown keyboard/Escape ·
G3 focus restore + `role="alert"` · G4 contrast (placeholder 2.3:1, inline red 3.4:1) ·
G5 skip link · G6 decorative alt.
**Coherence:** G7 hover token · G8 use the unused shadow tokens · G9 snap off-scale radii ·
G10 reference `--color-primary` · G11 optional type scale.
**Out of scope:** breakpoint tokens, elevation system, component library, dark mode, motion tokens.

## Phase H — Handoff documentation

`CLAUDE.md` ✅ · `docs/DECISIONS.md` ✅ · `docs/PLAN.md` ✅ (this file) ·
`docs/audit-2026-08-01.md` (full evidence, design folded in) · `docs/EXECUTION-GUIDE.md`
(load-bearing: per-task `file:line` anchors, copy-paste verification, acceptance criteria) ·
env-var map · this Phase A snapshot.

## Phase I — Next 16 / React 19 upgrade (separate branch + PR)

Unchanged — see D-004. Next 14 is EOL (26 Oct 2025), unpatched against the July 2026 fixes
(4 high + 5 medium, shipped in 15.5.21 / 16.2.11 only). Target **Next 16.2.x + React 19**, pin the
latest patched 16.2.x at execution time. Cut **after** C–G merge, then rebase — and note E7:
rebase onto `origin/main`, not the stale local `main`. Requires `gh`. Effort M–L.

---

## C-ENV — **NEW #1. Production points at a DEAD Supabase project. Signup has never worked.**

Discovered 2026-08-02 in post-deploy testing. **See D-012 for the full evidence.** Not a security
issue — a five-month outage.

- Production bundle carries project ref **`uvlprdktzayskmcwxcye`** → **NXDOMAIN**. Correct ref is
  `nofzyhxjpsikdhbcpfuo` (local `.env` is right). **Anon keys differ too** — a complete pointer to
  a dead Bolt-era project.
- Broken since the first deployment (env vars 148d old ≈ 2026-03-07; deployments 2026-03-07 and
  2026-03-10). The "dormant site" reading in this plan was wrong: it was **broken**, not idle.
- **Not caused by the C0/C4 deploy** — that touched only the edge function; this is a client-side
  DNS failure from a Vercel asset built five months earlier. **Do not roll back C0.**

**Fix (owner runs; Vercel MCP is read-only per guardrail 17):**
1. **Land C2 + the `REVOKE` first** — see the warning below.
2. Vercel → Settings → Environment Variables: set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the live project's values, across Production/Preview/Development.
3. Delete `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `RESEND_API_KEY` from Vercel (already
   recorded as cleanup — they belong to the dead project / are unused).
4. **Redeploy.** `NEXT_PUBLIC_*` is inlined at build time; changing the variable alone does nothing.
5. Retest signup on `https://www.nxtcollect.com` (not a `.vercel.app` URL — those 403).

> ### ⚠ ORDER MATTERS
> The C2 read leak is **currently inert in production** because the bundle points nowhere.
> **Fixing the URL activates it.** Land C2 (drop both anon policies) and the `REVOKE` **before or
> with** the env fix — otherwise the site goes from "broken but not leaking" to "working and
> leaking" in one step.

### The outage is a free maintenance window — use it

Because production is already down, **all the DB work can be done with zero user impact and zero
exposure**. There is no need to rush a partial fix. Recommended sequence:

| # | Step | Why here |
|---|---|---|
| 1 | **C-OPS baseline** (Option B) — dump, review, one baseline migration, mark applied, archive the six | Do it while nothing is live. Makes C2 a *tracked* migration instead of ad-hoc SQL |
| 2 | **C2 migration on top:** `DROP POLICY` ×2 + `REVOKE ALL … FROM anon, authenticated` | Leak closed while the site is still dark |
| 3 | **Deploy the edge function** with the insert + position relocated (D-002) | Restores the position feature that dropping the SELECT policy removes |
| 4 | **Verify with the anon key:** `select=*` → permission denied / 0 rows; insert via anon → denied | Prove it's closed *before* going live |
| 5 | **Fix Vercel env vars + REDEPLOY** (`NEXT_PUBLIC_*` is inlined at build time) | Site comes back up **already secured** |
| 6 | **End-to-end signup test on `https://www.nxtcollect.com`** | Confirm the thing actually works — the real definition of done |

**Zero leaking window**, because the site stays dark until step 5.

**Does C-OPS have to be first?** Strictly, no — steps 2's `DROP POLICY`/`REVOKE` are two statements
that could be run as raw SQL. But there is no time pressure (the site is already down), and doing
C-OPS first is the entire point of C-OPS: C2 then lands as a proper tracked migration rather than
another undocumented hand-edit, which is the exact habit that produced this mess.

**Fast path, if the site must go live sooner:** run `DROP POLICY … FOR SELECT` + `REVOKE` as raw
SQL, fix Vercel, redeploy. The form works and nothing leaks, but the "you're #N" milestone
degrades to generic copy (the client's `.select()` returns null) until step 3 lands. Acceptable
temporarily; do **not** let it become permanent, and record it if taken.

---

## LAUNCH LIST — FROZEN 2026-08-02. Scope is closed.

The site stays dark through step 7, so every step below has **zero user impact**. Go-live is
step 8 and nothing is added before it.

| # | Step | Notes |
|---|---|---|
| 1 | **C-OPS baseline + C2 migration** | Baseline written; C2 drafted. Includes the `REVOKE`, dropping the sequence for honest positions, and the redundant-index cleanup |
| 2 | **D-002 edge-function relocation** | Insert + position move server-side; `count(*)+1` for a gapless number |
| 3 | **Build-time guard** | Pin the expected project ref + cross-check the anon key's `ref` claim. ~10 lines, hermetic |
| 4 | **C6 minimal** | Two error branches (unreachable vs invalid input) + stop swallowing send failure |
| 5 | **GDPR** | Privacy policy, consent, unsubscribe, deletion path — all six languages |
| 6 | **Sender address + brand capitalisation** | `matthijs.email@` → a brand sender; `Nextcollect`/`NEXTCOLLECT` → `NextCollect` |
| 7 | **Next 16 + React 19** | Own branch, full regression. **See the tripwire below** |
| 8 | **Vercel env fix + fresh build + GO LIVE** | Production env, redeploy, end-to-end signup test on `www.nxtcollect.com` |

### Step 7 — why it is here, and when to abandon it

**The reason is EOL, not the July 2026 CVEs.** Exposure to those is near-zero for this app,
verified 2026-08-02: **no middleware** (so the middleware/proxy-bypass class has no attack
surface), no API routes, no route handlers, no server actions, no dynamic route segments. The
DoS-via-CPU class needs a server-side path processing attacker input; there isn't one.

The actual risk is that Next 14 will **never receive another patch** — every *future* CVE is
permanently unfixed. The migration surface here is tiny (zero hits on every React 19 breaking
change; Next 15's async request APIs entirely unused; 6 Next imports across 5 files), and the site
is already dark. Cheap work, free window, unbounded future exposure → do it now.

> **TRIPWIRE:** because this is *not* security-urgent, it must not block go-live. If step 7 is not
> cleanly done and regression-passed within the intended window, **ship on Next 14** and migrate in
> a scheduled dark window afterwards. A working site on an EOL framework beats a dark site on a
> supported one.

**Most likely breakage:** `Section/index.jsx:60` routes an **SVG through `next/image`** with no
`images` config and no `dangerouslyAllowSVG`. Next 16 tightened image defaults. Check this first.

### Validate step 7 without coupling it to go-live

Fix the **Preview** env vars first (previews are SSO-protected — zero exposure), deploy the
migration branch to a preview, and validate against the live Supabase project. Then do Production
env + promote. This keeps "did React 19 break it?" separable from "did the env fix break it?", and
stops step 8 being two large changes at once.

### Deferred to after go-live (explicitly not launch blockers)

**C3** rate limiting · **E** correctness (E1 og-image/favicon, E2 locale persistence, E3, E4, E6) ·
**G1–G4** a11y · **F** cleanup · **G7–G11** design coherence · **C1** (delete the count_estimate
file) · **C5** (reconcile the archived migration).

*C3 note:* deferring rate limiting is a real trade-off. It is safe only because the edge function
now rejects unregistered addresses (C0, verified) — the open-relay vector is closed. Volume abuse
remains possible; revisit immediately after launch.

**DONE:** ~~C0~~ (hardened edge function deployed 2026-08-02) · ~~C4~~ (folded into the same deploy).

**Must-fix before production:** C-ENV · C2 · C-OPS · C3 · D1–D5 · E1 · E2 · E5 · G1–G4 · I.
**Nice-to-have:** C1/C5 (trivial) · E3 · E4 · E6 · F (except F6) · G5–G11.

### OPEN — position ordinals can be REUSED once GDPR deletion exists

Raised by the owner 2026-08-02. **It is a real problem, and it is not solved.**

The edge function computes `registration_position` as `count(*) + 1`. That is exact today,
but D4 (the GDPR deletion path) will make deletions possible, and `count(*)` **decreases**:

```
positions 1,2,3 issued  →  #2 requests erasure  →  count = 2
next signup gets 3      →  a number #3 already received in their email
```

**Severity: low today, higher later.** Nobody can see anyone else's number and positions are
not displayed publicly, so duplicates are invisible in normal use. But the confirmation email
promises **"priority access at launch"** — if position ever determines actual ordering, duplicate
ordinals stop being cosmetic.

**Fix (one word, deliberately not applied yet):** use `COALESCE(MAX(registration_position), 0) + 1`
instead of `count(*) + 1`. Same cost, and monotonic unless the highest row is deleted. A dedicated
single-row counter that only ever increments would be fully correct, but is more machinery than a
waitlist warrants.

**Land it with D4**, since that is when deletions become possible. Do not ship a deletion path
while the ordinal is still count-based.

### C6 — NEW. Silent-failure sweep: why a five-month outage went unnoticed

The outage was invisible because **every database error renders the same generic sentence**:
`'There was an issue with this entry. Please try again.'` (`Hero/index.jsx:177-178`). A DNS
failure, an RLS denial, a network error and a schema error are indistinguishable to both the user
and the owner. **That message is the reason nobody noticed for five months** — fixing it is not
polish, it is outage detection.

Other paths that fail silently (found while sweeping for more of the same):

| Path | Failure mode | Fix |
|---|---|---|
| **Email send after a successful insert** | Success modal opens **before** the send is attempted (`Hero:183` → `:190`); failure only `console.error`s. User sees "you're in", no email ever arrives | **C4 client half — still open.** More urgent post-C-ENV |
| Signup from a `*.vercel.app` URL | Insert succeeds, edge function 403s (origin not allowlisted) → silent no-email | Expected by design; document, and surface the failure per above |
| `registration_position` unavailable | If the SELECT policy is dropped without relocating the read, `data` is null → milestone silently disappears | Exactly why D-002 relocates the insert rather than only dropping the policy |
| `og-image.png` 404 | Broken link previews, no error surfaced anywhere | E1 |
| `favicon.ico` 404 | Cosmetic, silent | E1 |
| dotlottie from `unpkg.com` (`layout.jsx:49`) | Third-party CDN blocked/down → animation silently absent | F3, or drop the CDN dependency |

**Action:** distinguish user-facing error classes — "that email is already registered" (a real
answer) vs "we couldn't reach the service, try again" (an outage) — and surface email-send failure
instead of swallowing it. Add to C4/E3. Effort S. **Impact: high — this is the difference between
a future outage being noticed in minutes versus months.**

### Minor console noise (recorded, not urgent)
- `/favicon.ico` → 404. `layout.jsx:38-41` points `icons` at an SVG; no `favicon.ico`, no
  `apple-touch-icon`. Fold into E1 with the `og-image.png` fix.
- `dotlottie-wc.js` preload `crossorigin` mismatch — the `next/script` tag at `layout.jsx:49` loads
  it from unpkg.com without a matching `crossorigin`, so the preload is fetched twice. Fold into F3
  (or drop the third-party CDN dependency for a decorative animation).

---

## Ponytail: flagged vs recommended

**Flagged and acting on:** delete the `count_estimate` migration (C1 — and Phase A proved deletion
is now the *complete* fix, not just the lazy one); drop redundant anon policies (C2); orphan i18n
files (F1); Bolt residue (F2); unused assets (F3); de-dupe (F5).

**Flagged but OVERRIDDEN — conflict reported per the precedence rule:**
- **C0, C3, C4, C5, D1–D4, F6, G1–G6** all **add** code or work. Ponytail's "less code" bias is
  overridden by security, correctness, legal and a11y findings. These stay.
- **"Skip C-OPS, just use the SQL editor"** is the lazy path and is **rejected as the default**:
  it entrenches repo/production drift, which is precisely what made this audit necessary.
- **Phase I** is the opposite of lazy, but it is security. It wins.

---

## Where the original step list was wrong / incomplete

1. **"Supabase (database/auth)" — there is no auth.** Only the anon key and a public form.
2. **Reading the repo misrepresents production.** Phase A's central lesson: the deployed edge
   function, the live INSERT policy, and the migration ledger all differ from the files.
3. **Not anticipated, added:** the deployed-vs-repo function gap; the missing migration ledger;
   anon's full table grants; the public GitHub repo; local `main` being stale; the spam complaint;
   plus (pre-Phase-A) the read leak, Next 14 EOL, `.env` in history, orphan i18n files, locale
   override, missing `og-image.png`, zero tooling, stale `.next`, broken `tsconfig`, 1.6 MB email
   image, and the total absence of GDPR affordances.

---

## Verification (after fixes)

1. **Build:** `npm ci && npm run build` — clean on current source.
2. **Leak closed:** the probe above returns **0 rows**; `rpc/count_estimate` stays 404.
3. **Deployed = repo:** re-run `get_edge_function` and confirm the live source matches the repo
   (no `{{`, no `Access-Control-Allow-Origin: "*"`, no raw `${registrationPosition}`).
4. **Open relay closed:** POST an unregistered address → rejected, **no email sent** (confirm via
   Resend logs, which must show no new send).
5. **Signup e2e:** submit → row appears (service role, not anon), email delivers, correct position;
   duplicate → "already registered", **no position disclosed**.
6. **Rate limit:** N rapid submits → `429` + `Retry-After`; rows purge; IPs stored **hashed**.
7. **Migrations:** `supabase migration list` shows local and remote in sync.
8. **GDPR:** privacy policy in all 6 languages; consent recorded; unsubscribe works.
9. **A11y:** keyboard-only pass; contrast ≥ 4.5:1.
10. **Phase I (separate PR):** full regression on Next 16.2.x + React 19.
