# NextCollect Coming-Soon Page — Audit & Remediation Plan

> **This file (`docs/PLAN.md`) is CANONICAL.** A copy exists in Claude Code's local plan
> storage (`~/.claude/plans/`) from the planning session; it is **superseded and must not be
> edited or read as authoritative**. Update this file only.
>
> **Status: NOT APPROVED FOR EXECUTION. Phase A (service verification) has not run yet.**
> Every item tagged **`UNVERIFIED — pending Phase A`** has a severity that depends on live
> remote state I could not reach. Do not treat those as confirmed.
> Last updated: 2026-08-01. Branch `resume-audit`. Rollback point: commit `8ee91f0`.
> Decisions and rejected alternatives: [`DECISIONS.md`](DECISIONS.md). Guardrails: [`../CLAUDE.md`](../CLAUDE.md).

## Context

A Next.js 14 (App Router, JSX, CSS Modules) coming-soon page: a 6-language email-capture form
backed by Supabase (Postgres + one Deno edge function) sending a Resend confirmation email.
Scaffolded in Bolt.new, continued in Codex, hosted on Vercel.

Dormant, then partly worked on: commit `8ee91f0` is a WIP checkpoint that **partially implements
a prior (2026-03-12) audit** whose report no longer exists — its findings survive only as code
changes plus three inline `// Issue #N` markers. This plan re-reviews everything with fresh eyes,
classifies that in-flight work, and sequences remediation. Goal: a professional, production-ready
launch page — **not maximum change**.

**Code-level findings in this plan are evidence (files were read). Live remote state is not.**
See Phase A.

---

## Phase A — Service verification (MUST RUN FIRST)

| Service | MCP | CLI | State | Gap |
|---|---|---|---|---|
| **Supabase** | none | `supabase` v2.67.1, project **LINKED** (`nofzyhxjpsikdhbcpfuo`, North-EU) | authed + linked | **DB introspection blocked** — needs `SUPABASE_DB_PASSWORD` (timed out) |
| **Resend** | none | none | code-only knowledge | **SPF/DKIM/DMARC + delivery status unknown** |
| **Vercel** | none | not installed | no `vercel.json` in repo | **env vars, preview protection, build status unknown** |
| **GitHub** | none | `gh` not installed | git-over-HTTPS works | **Deferred, not dropped** — `gh` needed for the Phase I PR |

**Why this gates the plan:** three outcomes could re-rank everything.
1. If `public.count_estimate` is **not** live/anon-executable, C1 drops from critical to prevention.
2. If Resend domain auth is **broken**, no confirmation email has ever arrived — that becomes the
   #1 item, above the security work, since email delivery is this site's entire function.
3. If a Resend/service key was set as a `NEXT_PUBLIC_*` var in Vercel, that is a **new critical**.
   (Repo source is clean — only `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` are referenced, and no
   hardcoded `re_*` or JWT literals exist. Only the dashboard can confirm the deployed config.)
4. **If RLS is not actually enabled on the table, C2 does not work as designed** — dropping policies
   changes nothing, because inert policies were never what restricted access. See D-002.

### Phase A read-only queries (Supabase SQL Editor)

```sql
-- (1) LOAD-BEARING: is RLS actually on? Must be true, or C2's policy drops are meaningless.
SELECT relrowsecurity, relforcerowsecurity FROM pg_class
WHERE relname = 'nextcollect_registration_records';

-- (2) Does the arbitrary-SQL function exist, and is it SECURITY DEFINER?
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'count_estimate';

-- (3) Can anon execute it?  (skip if (2) returned no rows)
SELECT has_function_privilege('anon', 'public.count_estimate(text)', 'execute');

-- (4) Are the permissive policies live?
SELECT polname, cmd, qual, with_check FROM pg_policies
WHERE tablename = 'nextcollect_registration_records';

-- (5) What table-level grants does anon hold, independent of RLS?
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name = 'nextcollect_registration_records' AND grantee IN ('anon','authenticated');
```

Query (5) determines whether the **`REVOKE ALL ... FROM anon`** defence-in-depth step in D-002 is
needed. Expect Supabase's stock grants to appear — no migration in this repo issues any
`GRANT`/`REVOKE`.

---

## Prior-audit reconciliation (`8ee91f0`) — 8 done, 2 partial, 2 inconsistent, 1 untouched

| # | Prior finding | Verdict | Note |
|---|---|---|---|
| 1 | Email `{{placeholder}}` vars | Done | All resolved; logo now inline SVG |
| 2 | `registrationPosition` raw into HTML | Done | `Number.isInteger && >0 ? : null` before use |
| 3 | No rate limiting | **Not touched** | Origin allowlist + registered-email check added instead — adjacent, not rate limiting |
| 4 | Footer "Protech" | Done (code) | `README.md:115` still says "Protech" |
| 5 | No Open Graph tags | **Inconsistent** | OG/Twitter added but `public/img/og-image.png` **does not exist** → previews 404 |
| 6 | `app/lib/supabase.js` dead | Done | Deleted; empty `app/lib/` dir remains on disk |
| 7 | `app/lib/validation.js` dead | Done | Deleted |
| 8 | Errors hardcoded English | **Inconsistent** | 6/7 use `t()`; `Hero/index.jsx:147` still raw English, leaks internal state |
| 9 | `<html lang="en">` hardcoded | Partial | Still hardcoded `layout.jsx:46`; patched client-side only → SSR/crawlers see `en` |
| 10 | Plain `<img>` | Done | All `next/image`. Verify `Section:60` SVG-through-optimizer under Next 16 |
| 11 | Google Fonts `@import` | Done | Now `next/font/google` Inter |
| 12 | No submit loading state | Done | `isSubmitting` + `isResending` |
| 13 | Modal state not reset | Done | `handleCloseSuccess` resets all six pieces |

**Where I disagree with the prior audit:** it missed every high-severity item — the `count_estimate`
function, the anon SELECT-all leak, the EOL framework, `.env` in git history, the locale-persistence
bug, and the total absence of GDPR affordances. It was a UX/cleanup pass, not a security review.
Treat its 13 items as closed-out leads; the real risk is below.

---

# Revised execution sequence (A–I)

## Phase A — Verify (see above). Stop and update this file with results.

## Phase B — Pre-flight safety (before ANY database change)

**B1. Export the subscriber table.** No planned change deletes rows (dropping policies and functions
touches no data), but there are **real subscriber signups** and live-DB surgery always carries
operator-error risk. Backup posture (plan tier / PITR) is **UNVERIFIED — pending Phase A**.
- Dashboard CSV export, or `supabase db dump --data-only -t nextcollect_registration_records > backup.csv`
- Store outside the repo. Effort XS. **Non-negotiable gate for Phase C.**

**B2. Confirm rollback point** — `8ee91f0` (WIP checkpoint). `git reset --hard 8ee91f0` restores code.
Note: code rollback does **not** undo DB changes — hence B1.

## Phase C — Security must-fix (production blockers)

**C1. Remove the `count_estimate` arbitrary-SQL function.**
*Code evidence: `supabase/migrations/20260314223534_fix_count_estimate_search_path.sql:13-29`.*
*Live status: **UNVERIFIED — pending Phase A**.*

`SECURITY DEFINER` function taking caller-supplied `query text` into `EXECUTE 'EXPLAIN ' || query`,
with **no `REVOKE ... FROM PUBLIC`**. Postgres grants EXECUTE to PUBLIC by default and PostgREST
exposes `public` functions as RPC → reachable at `POST /rest/v1/rpc/count_estimate` with the anon key
that ships in the JS bundle. `EXPLAIN (ANALYZE) DELETE FROM ... RETURNING 1` **executes** as the
function owner, bypassing RLS. `SET search_path=''` does not mitigate (attacker schema-qualifies).
Called by nothing in the repo.

**Correct handling depends on remote state — these are two incompatible paths:**
- **Function does NOT exist on remote / migration never pushed** → delete the migration file. Clean.
- **Function EXISTS on remote** → **do NOT delete the file.** Deleting an applied migration desyncs
  local history from the remote `supabase_migrations.schema_migrations` ledger permanently. Instead add
  a **new forward migration** `..._drop_count_estimate.sql` containing
  `DROP FUNCTION IF EXISTS public.count_estimate(text);` and push that. History stays linear.
  (`supabase migration repair` can reconcile the ledger if you also want the original file gone —
  advanced, usually unnecessary.)

**Critical framing correction:** the repo shows `count_estimate` appearing **only** in migration 6, as
`CREATE OR REPLACE`, first introduced in `8ee91f0` (verified via `git log -S`). But the migration's own
comment references a pre-existing `pg_temp_22.count_estimate` advisor warning, which implies a version
was created on the remote **outside migrations** (likely by Studio tooling). Therefore:
- The remote check is **"does `public.count_estimate` exist and can `anon` EXECUTE it?"** — *not*
  "was migration 6 applied."
- **The remote DROP is required regardless of what happens to the file.** Deleting migration 6 does
  nothing to a manually-created function.

Effort XS. Impact **critical if live**.

**C2. Close the subscriber-list read leak (RLS) via full edge-function relocation.**
*Code evidence: `supabase/migrations/20260107141200...:41-49` — verified.*
*Live status of policies: **UNVERIFIED — pending Phase A** (high confidence: it is the app's active table).*

```sql
CREATE POLICY "Users can view own registration"
  ON nextcollect_registration_records FOR SELECT TO anon USING (true);
```
The name lies; the predicate returns **every row**. `GET /rest/v1/nextcollect_registration_records?select=*`
with the anon key dumps every email, country, timestamp and position. Anon has no identity, so a genuine
"own-row" policy is impossible. INSERT is likewise `WITH CHECK (true)`.

**Decided approach (owner, this session): FULL INSERT RELOCATION.** Move both the insert and the
position read into the existing `send-confirmation-email` edge function (service role), then **drop both
anon policies**. The anon key can then no longer read or write the table at all.
- Edge fn: accept `{email, country}`, validate (format, length, `country ∈ EUROPEAN_COUNTRIES`), service-role
  `INSERT ... RETURNING registration_position`, handle `23505` duplicate, send email, return `{position, emailSent}`.
- Client: `Hero/index.jsx` submit becomes a single fetch; remove the `.insert().select()` at `:166-170`
  (that returning-select is the *only* reason the SELECT policy exists).
- **Why this and not an RPC:** a `my_position(p_email)` function callable by anon is an email-enumeration
  oracle. Relocation is the only design that satisfies the constraint *"position must not be readable for
  an arbitrary caller-supplied email"* — the function returns a position **only when it performed the insert
  in that same request**; an already-registered email returns "already registered" with **no position**, so
  positions are never queryable after the fact.
- Local dev needs `supabase functions serve` + `ALLOW_LOCAL_ORIGIN=true`.
- Effort **M** (~half a day incl. testing). Impact **critical — active leak**.

**C3. Add rate limiting to the edge function.** *Verified absent (no `429`/throttle/ratelimit anywhere).*

The origin allowlist is a **browser** control only — `curl -H 'Origin: https://nxtcollect.com'` bypasses it.
With the anon key, anyone can mail-bomb every address (amplified by C2's dumped list), burn the Resend quota
and destroy sending reputation. Becomes *more* important once the edge fn is the sole write path.

**Design (decided): a Postgres throttle table.** Per-IP **and** per-email windows, checked service-side
before insert/send; return `429` + `Retry-After`.
- **GDPR-safe construction (required):** store a **salted hash of the IP**, never the raw IP, and **purge
  rows past the window**. Lawful basis: abuse/fraud prevention as a legitimate interest (**GDPR Recital 49**) —
  defensible without consent. Document both in the privacy policy (D1).
- **The per-email dimension is also personal data** — same retention/purge discipline applies to it,
  regardless of how the IP is handled.
- **In-memory / TTL counters are NOT viable and must not be proposed:** Supabase edge functions run on
  ephemeral, horizontally-scaled Deno isolates, so counters are not shared across instances and an attacker
  simply gets a fresh bucket per isolate. Persistent table is the correct design. (Upstash Redis / Deno KV
  would also work but add a dependency — gold-plating unless volume warrants.)
- Effort **S–M**. Impact **high**.

**C4. Stop internal-detail leakage and silent email failure.**
*Verified: `index.ts:296` returns raw Resend error body (`details: result`); `:321` returns `error.message`.
`Hero/index.jsx:198-204` only `console.error`s on send failure.*
- `details` become log-only; client gets generic messages.
- The success modal currently opens **before** the email is attempted (`:183`), so a total Resend outage is
  invisible to both user and owner. Wire the real failure signal into the modal's existing "didn't receive?"
  + resend affordance.
- Effort S. Impact **high** (leak) / **med** (silent failure).

**C5. Restore the INSERT validation lost in migration 5.** *Verified regression vs `20251201195231:12-16`.*
Migration 2 deliberately set `WITH CHECK (email<>'' AND country<>'')`; migration 5 recreated the table with
`WITH CHECK (true)`, silently dropping it. **Moot if C2-full drops the INSERT policy** — but the equivalent
validation must then live in the edge function (it does, per C2). Currently arbitrary unbounded `country`
text can be stored. Effort XS. Impact med.

## Phase D — EU launch conditions (GDPR) — **re-tiered from polish, per owner**

**Verified state: there is no privacy affordance of any kind.** A grep of `app/` and all six i18n files for
`privacy|consent|terms|gdpr|unsubscribe|opt-in|cookie` returns **zero hits**. The form
(`Hero/index.jsx:248-329`) collects email + country with **no consent checkbox, no privacy notice, no
privacy-policy link**; `Footer/index.jsx:4-15` is copyright + social only; the confirmation email has **no
unsubscribe**. EU-facing form, EU-region DB, six European languages, and C3 will add IP-derived data.
**These are launch conditions, not polish.**

- **D1. Privacy policy** + link in footer and next to the form. Must cover: what is collected, lawful basis
  (consent for marketing email; Recital 49 legitimate interest for the throttle), retention, processors
  (Supabase, Vercel, Resend), and data-subject rights. Effort S–M (needs your copy/legal input).
- **D2. Consent / lawful basis at point of collection** — explicit opt-in wording or checkbox for the
  marketing email; record it. Effort S. **Needs your decision** on wording/mechanism.
- **D3. Unsubscribe** — `List-Unsubscribe` header **plus a working mechanism** (the email footer currently
  implies a legitimate-mail posture with no way to leave). Effort S–M.
- **D4. Deletion path** — a documented route for erasure requests (a monitored address is sufficient at this
  scale; must be stated in D1). Effort XS–S.
- **D5. Email deliverability** — verify Resend SPF/DKIM/DMARC. **UNVERIFIED — pending Phase A.** If broken,
  this jumps to the top of the whole plan.

All of D translates into six languages — budget for translation.

## Phase E — Correctness

- **E1.** Missing `public/img/og-image.png` (`layout.jsx:24,36`) → broken previews. Create 1200×630 or
  repoint; add `metadataBase`. XS.
- **E2.** **Locale not persisted + actively overridden** — `LanguageProvider` holds locale in state only, and
  `Navbar/index.jsx:26-33` unconditionally overwrites it with `navigator.language` on mount, so a user who
  picks EN gets their browser language back on refresh/remount. Persist to `localStorage`; seed from
  `navigator.language` only when nothing is stored. S. **Real UX bug.**
- **E3.** Untranslated internal error `Hero/index.jsx:147` — add an i18n key, drop the "set the Supabase keys"
  wording. XS.
- **E4.** `<html lang>` SSR-correct (`layout.jsx:46`), or document as a known limitation. S.
- **E5.** **Prove it runs:** `.next` is stale (predates the committed source — the in-flight work has never
  been built). `npm ci && npm run build`. XS. *(`.next/` is gitignored at `.gitignore:2` and not tracked.)*
- **E6.** `tsconfig.json` references non-existent `tsconfig.app.json` / `tsconfig.node.json` (Vite/Bolt
  residue). XS.

## Phase F — Structure / cleanup (ponytail-informed)

- **F1.** Delete the 4 **space-prefixed orphan i18n files** (` de.json`, ` es.json`, ` fr.json`, ` it.json`) —
  tracked, unimported, older and differently-worded (German "du" vs live "Sie"). Highest-value deletion; a
  translator trap. XS.
- **F2.** Delete Bolt residue: `.bolt/ignore` (points at nonexistent `src/`), empty `app/lib/`,
  `Section/index.jsx:4` `// Issue #10` marker, `tsconfig.tsbuildinfo`. XS.
- **F3.** Remove unused assets (`frame.svg`, `vector.svg`, `right-1.png`, `social-media---menu-icons.svg`) and
  **shrink `Nextcollect_Welcomes_Email_Profile-Images_v03.png` (1.6 MB, embedded in every email)**. S.
- **F4.** Rewrite the stale `README.md` (wrong primary color, phantom `footer---right.svg`, "Protech",
  missing directories). S.
- **F5.** De-dupe byte-identical scroll-to-hero logic (`Navbar:52-64` ≡ `Section:72-84`) and the milestone
  thresholds duplicated across `Hero:21` / `index.ts:104`. S. Low priority.
- **F6.** **Add minimal tooling** — there is no lint, no test, no typecheck script and no ESLint config at all.
  Add `eslint-config-next` + a `lint` script; smoke tests for `validateEmail` and the edge-fn
  validation/position logic. **This ADDS code and is correct** — ponytail does not apply to safety nets. S.
- **F7.** Dead import: `SocialMedia` imported but never rendered in `Hero` (`Hero/index.jsx:8`). XS.

## Phase G — Design coherence + accessibility

**A system already exists and the build drifted off it — the job is "finish the system that's already
there", NOT build a design system.** `tokens.css:19-42` defines a real spacing scale (`--space-1..40`),
radius scale (`--radius-sm..pill`), color roles, and two shadow tokens. Inputs are internally consistent:
`.emailInput` / `.countrySelect` share padding, `--radius-md`, font-size and focus treatment
(`Hero/styles.module.css:86-96, 138-145`). Roughly **80% coherent**.

**Accessibility (not polish):**
- **G1. `.submitButton` has `:hover` but no `:focus-visible`** (`Hero/styles.module.css:184-201`) — keyboard
  users get no focus indication on the primary action, while inputs do. **A11y defect.** XS.
- **G2.** Country dropdown keyboard support (`Hero/index.jsx:267-317`): no Arrow-key nav, no `aria-controls`,
  **Escape does not close it** (the Escape listener is mounted only while the success modal is open), tabbing
  out leaves it open. S–M.
- **G3.** Restore focus to the trigger on modal close; `role="alert"` + `aria-describedby`/`aria-invalid` on
  the validation message (`:331` is `role="status"`/polite — wrong for errors). S.
- **G4.** Contrast failures: `.emailInput::placeholder` `#9e9e9e` on `--white` ≈ **2.3:1**
  (`styles.module.css:102-104`); inline `color:'red'` on white ≈ **3.4:1** (`Hero/index.jsx:370`). Both fail
  4.5:1. XS–S.
- **G5.** Skip link + `<main id>` target (sticky navbar precedes content). XS.
- **G6.** Decorative alt cleanup: feature icons use `alt={feature.title}`, duplicating the adjacent `<h3>`
  (`Section:60-61`) → `alt=""`; `SocialMedia:38` has `aria-label` on a role-less `<div>`. XS.

**Design coherence (worth doing — small, high return):**
- **G7.** Add a **hover-color role token** — `#e3dfd5`, `#d8d1c2`, `#3f0ddc` are hardcoded and repeated across
  Hero/Navbar/Section (`Hero:119,177,181`). XS.
- **G8.** Use the **existing unused** `--shadow-soft` / `--shadow-strong` instead of hand-rolled shadows
  (`.countryMenu` `0 20px 40px rgba(0,0,0,0.18)` at `:155`, `.successCard`). XS.
- **G9.** Snap off-scale radii to tokens — `.successCard { border-radius: 24px }` (`:244`) is off-scale
  (tokens have 20 and 30); also `10px` / `12px`. XS.
- **G10.** Reference `--color-primary` instead of re-encoding it numerically as `rgba(71,15,244,…)`
  (`:143-144`). XS.
- **G11.** *Optional:* a 4–5 step type scale in `tokens.css` — currently only `--font-size-base` exists, so
  every component invents its own sizes. S.

**Explicitly OUT OF SCOPE (overkill for a one-page site):** breakpoint tokens, a shadow-elevation system, a
component library, dark-mode theming, motion tokens.

## Phase H — Handoff documentation (written with Phase-A-verified facts)

Executed by a **different model with no access to this conversation**, so everything must live in files.
- `CLAUDE.md` (repo root) — **drafted now**; guardrails + "do NOT" list.
- `docs/DECISIONS.md` — **drafted now**; the seven de-trapped decisions + rejected alternatives.
- `docs/audit-2026-08-01.md` — full findings with `file:line` evidence, **including design findings folded in**
  (a context-less model reads fewer files more reliably than more).
- `docs/EXECUTION-GUIDE.md` — **the load-bearing doc.** Self-contained, ordered, per task: exact `file:line`
  anchors, copy-paste verification commands, and **acceptance criteria**.
- Plus: the Phase-A **verified-state snapshot**, a **backup/rollback pointer** (`8ee91f0` + the B1 export),
  and an **env-var map** (each name and where it lives).

## Phase I — Next 16 / React 19 upgrade (separate branch + PR)

**Security-ranked, not polish:** Next 14 reached **EOL 26 Oct 2025** and receives **no security patches**.
The July 2026 release fixed **4 high** (incl. DoS and middleware/proxy bypass) **+ 5 medium** in **15.5.21 /
16.2.11 only**; this project is on **14.2.33**, unpatched.
- Target **Next 16.2.x (Active LTS) + React 19** + matching `@types`. Pin to the latest patched 16.2.x at
  execution time (≥16.2.11 carries the July fixes — **verify the current patch level, don't assume**).
- Not 15.5.x: it is Maintenance LTS ending **21 Oct 2026** (<3 months), and both targets require React 19,
  so the migration cost is identical — pick the one with runway.
- **Sequencing:** cut this branch **after** C–G merge, then rebase. Both C2 and this touch
  `Hero/index.jsx` (submit-handler region) — real but small overlap once ordered.
- Full regression: SSR, form, modal, i18n, images (**verify `Section:60` SVG through `next/image`** — no
  `images` config / `dangerouslyAllowSVG` exists), edge-fn call.
- Requires `gh` (deferred from Phase A, not dropped). Effort M–L.

---

## Must-fix before production vs nice-to-have

**Must-fix:** C1–C5 (all security) · D1–D5 (EU launch conditions) · E1, E2, E5 · G1–G4 (a11y) ·
I (EOL framework).

**Nice-to-have:** E3, E4, E6 · all of F (except **F6 tooling**, which I'd insist on) · G5–G11 ·
`.env`-history key rotation (below).

**Owner decision, low priority:** `.env` was committed in history (`3f6e53e`, re-added `1b79a34`) with
**anon/public** Supabase keys + dead `VITE_*` residue. `RESEND_API_KEY` was **never** committed. Anon keys
are public by design → limited blast radius. Options: rotate the anon key (cheap, clean) or accept and
document. History rewrite only if you want the residue gone. Current `.env` is correctly gitignored.

---

## Ponytail: flagged vs recommended, and conflicts

**Flagged AND acting on:** delete `count_estimate` (C1 — laziest *is* correct); drop redundant anon policies
(C2); delete orphan i18n files (F1); Bolt residue (F2); unused assets (F3); de-dupe scroll logic +
thresholds (F5); service-role client used for a query anon could do (simplifies under C2).

**Flagged but OVERRIDDEN — conflict reported per the precedence rule:**
- **C3 rate limiting, C5 validation, C4 error handling, D1–D4 GDPR, F6 tests/lint, G1–G6 a11y** all **add**
  code. Ponytail's "less code" bias is explicitly overridden by security, correctness, data-loss, legal and
  UX findings. These stay.
- **`count_estimate`: "just `REVOKE` instead of dropping"** would be the laziest patch; **rejected** —
  the function serves no caller and the advisor warning it targeted concerned a different, transient object.
  Deletion is lazier long-term and safer.
- **Phase I** is the opposite of lazy, but it is security. It wins.

---

## Where the original step list was wrong / incomplete for this codebase

1. **"Supabase (database/auth)" — there is no auth.** No login/identity anywhere; only the anon key and a
   public email-capture form. So "auth gaps" and "auth/sign-up/login flows" **do not apply** — the only user
   flow is *email → confirmation email*. RLS `TO authenticated` gaps are latent, not active.
2. **Vercel and Resend are unverifiable from here**; Supabase DB introspection needs a password (Phase A).
3. **Not anticipated by the original list, added here:** the `count_estimate` critical; the anon SELECT-all
   leak; Next 14 being **EOL** (security, not "outdated dep"); `.env` in git history; the 4 space-prefixed
   orphan i18n files; locale not persisted + `navigator.language` clobbering user choice; missing
   `og-image.png`; **zero lint/test/typecheck tooling**; stale `.next`; broken `tsconfig`; a 1.6 MB image in
   every email; and **the complete absence of GDPR affordances** on an EU-facing form.

---

## Verification (after fixes)

1. **Build & run:** `npm ci && npm run build && npm run dev` — clean build on current source.
2. **Leak closed:** `curl "$URL/rest/v1/nextcollect_registration_records?select=*" -H "apikey: $ANON"`
   returns **no rows**; `curl .../rpc/count_estimate` returns **404**.
3. **Signup e2e:** submit → row appears (verified via service role, **not** anon), email arrives, modal shows
   correct position; duplicate email → clean "already registered" with **no position disclosed**.
4. **Rate limit:** N rapid submits/resends → `429` + `Retry-After`; throttle rows purge past the window;
   stored IP values are **hashes**, not raw addresses.
5. **Edge fn errors:** force a Resend failure → user sees a friendly failure (not silent success); response
   body carries **no** internal `details`.
6. **i18n/locale:** switch language → persists across reload; browser language does **not** override a stored
   choice; `<html lang>` matches.
7. **GDPR:** privacy policy reachable in all 6 languages; consent recorded; unsubscribe works end-to-end.
8. **A11y:** keyboard-only pass — submit button shows focus, dropdown arrow-keys + Escape work, focus returns
   from the modal; contrast ≥ 4.5:1.
9. **Phase I (separate PR):** full regression on Next 16.2.x + React 19, incl. SVG through `next/image`.
