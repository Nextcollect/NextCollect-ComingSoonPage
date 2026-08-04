# EXECUTION — remaining work, ordered

**You are picking this up with no memory of the conversation that produced it. That is expected.**
Everything you need is in files. Read in this order:

1. `../CLAUDE.md` — guardrails, especially the numbered **DO NOT** list
2. `DECISIONS.md` — D-001…D-012, with rejected alternatives and reasoning
3. `PLAN.md` — the frozen launch list and the full findings
4. **This file** — what is done, what is next, and how to verify each step

> **The single most important fact: this site has never worked in production.** The deployed
> bundle points at a deleted Supabase project (D-012). "Done" is *a visitor can sign up and receive
> a confirmation email* — not "the security findings are closed." The site is deliberately DARK
> until step 8.

---

## Status as of 2026-08-02

| Step | State |
|---|---|
| 1. C-OPS baseline + C2 migration | ✅ **DONE — applied to production** |
| 2. D-002 edge-function relocation | ✅ **DONE — deployed, version 5** |
| 3. Build-time guard | ✅ **DONE** |
| 4. C6 minimal | ✅ **DONE** (landed inside step 2) |
| 5. GDPR | 🟡 **PARTIAL** — inventory done; plumbing not started; policy blocked |
| 6. Sender address + brand capitalisation | ⬜ not started |
| 7. Next 16 + React 19 | ✅ **DONE on branch `next16-upgrade`** — builds and renders clean; not merged |
| 8. Vercel env fix + go-live | ⬜ not started |

### Verified production state (2026-08-02, read-only MCP + curl)

- Supabase project **`nofzyhxjpsikdhbcpfuo`** (North EU/Stockholm). This is the ONLY live project;
  `uvlprdktzayskmcwxcye` and `0ec90b57d6e95fcbda19832f` are **NXDOMAIN**, deleted, unrecoverable.
- `nextcollect_registration_records`: **0 rows**, RLS on, **0 policies**,
  ACL `{postgres, service_role}` — anon and authenticated have **no access at all**.
- Sequence dropped; `registration_position` has no default; positions come from the edge function.
- Migration ledger: `20260802100000` (baseline) + `20260802100100` (C2), both applied.
- Edge function `send-confirmation-email` **version 5**, `verify_jwt: true`, matches the repo.
- Resend domain `nxtcollect.com` **verified**, sending enabled, eu-west-1. Open/click tracking OFF.
- Vercel: production deployment is from **`origin/main` = `a38ec731`** (2026-03-10) and carries the
  **wrong Supabase project**. Preview deploys are SSO-protected. Env vars still wrong — step 8.

### Git state

`resume-audit` is the working branch. **Local `main` is stale**: `origin/main` = `a38ec731` is
2 commits ahead of local `main` = `b3a428e`. `resume-audit` has diverged (ahead + behind).
**`git fetch origin` and rebase before opening any PR.** Verified: 0 merge conflicts.

---

## Step 5 — GDPR (partial)

Read `GDPR-INVENTORY.md` first: it has the scope split, the translation decision, and the full
factual inventory.

### 5a. Plumbing — decision-independent, safe to build now

**Unsubscribe** (the highest-value item — this domain's reputation is fragile, see the watch item
in `PLAN.md`):
- Add `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers to the
  Resend call in `supabase/functions/send-confirmation-email/index.ts`.
- Build a one-click unsubscribe endpoint. Token must be **unguessable and per-address** — an HMAC
  of the email with a server-side secret, not the email itself, or the URL becomes an enumeration
  oracle (the same mistake D-001 exists to prevent).
- **The unsubscribe page must be localized in all six languages.** An English-only exit wall
  converts into spam complaints.

**Plain-text alternative**: the Resend call currently sends `html` only. Add `text`. Helps
deliverability and accessibility.

**Consent record**: columns for the consent wording version and timestamp, so what was agreed is
provable later.

**Retention** (owner-decided): hold until launch + 6 months, or until erasure requested, whichever
is first. Throttle table purged per-window.

### 5b. Blocked — do NOT ship

- **Privacy policy prose** — blocked on the controller's legal identity (open question 1 in
  `GDPR-INVENTORY.md`). Do not hand-write it; use a template/lawyer with §3 of that file as input.
- **Erasure route** — `info@nxtcollect.com` is **NOT confirmed monitored**. Do not publish it as
  the erasure contact until the owner confirms. Alternatives if it is not monitored are listed in
  `PLAN.md` → Phase D.

### 5c. Consent mechanism — DECIDED

Submission-as-consent with a clear notice **above** the submit button, localized in all six
languages. No tick-box.

**Constraint that follows and must not be forgotten:** this consent covers *the launch
announcement the user asked for*. It does **not** cover newsletters, product updates or offers.
Sending those later needs fresh consent. Word the notice to say exactly what will be sent.

---

## Step 6 — sender address + brand capitalisation

Everything a real signup sees. All in
`supabase/functions/send-confirmation-email/index.ts` unless noted.

| Fix | Current | Target |
|---|---|---|
| Sender | `matthijs.email@nxtcollect.com` — reads as a personal test address | A brand sender, e.g. `hello@` / `team@`. **Must exist on the verified domain** |
| Subject | `Welcome to Nextcollect - …` | `NextCollect` |
| Email `<title>` | `Welcome to our platform` — placeholder | Real title |
| Email body | `Team Nextcollect` | `Team NextCollect` |
| Email footer | `Copyright © NEXTCOLLECT` | `NextCollect` |
| Site-wide | `NextCollect` ×9, `Nextcollect` ×4, `NEXTCOLLECT` ×1 | One spelling: **NextCollect** |

Also queued here: `Test_`-prefixed assets ship to real users —
`Test_on_the_list_v03.png` (in every email) and `Test_header_Image.png` (used **twice, for two
different things**: hero and about). Rename, and give the about section its own image.

**Verify:** `grep -rohE "Nextcollect|NextCollect|NEXTCOLLECT" app/ supabase/functions/ | sort | uniq -c`
→ only `NextCollect`.

---

## Step 7 — Next 16 + React 19 (own branch)

**Read D-004 before starting.** The justification is **EOL, not the July 2026 CVEs** — exposure to
those is near-zero here (no middleware, no API routes, no server actions, no dynamic segments).

> **TRIPWIRE:** this must NOT block go-live. If it is not cleanly regression-passed within the
> intended window, **ship on Next 14** and migrate later in a scheduled dark window.

- Target **Next 16.2.x** (latest patched — verify the current patch level, ≥16.2.11) + **React 19**
  + matching `@types`. Not 15.x (Maintenance LTS ends 21 Oct 2026).
- Measured migration surface: **zero** occurrences of every classic React 19 breaking change
  (`propTypes`, `defaultProps`, `ReactDOM.render`, `findDOMNode`, `forwardRef`, string refs, legacy
  context). Next 15's async `cookies`/`headers`/`params`/`searchParams` is **entirely unused**.
  6 `next/*` imports across 5 files.
- **The flagged SVG risk did NOT materialise.** Verified on Next 16.2.12: SVGs are **not** routed
  through the optimizer at all — the rendered HTML uses the raw path (`src="/img/….svg"`) and all
  8 SVG assets return 200. Forcing an SVG through `/_next/image` returns 400, which is Next
  correctly *refusing* to optimize SVG without `dangerouslyAllowSVG` — the safe default. **No
  `images` config is needed.**

### npm audit reports 3 highs — assessed, and NOT a blocker

`npm audit` flags `postcss@8.4.31` and `sharp@0.34.5`. Both are **transitive dependencies of Next
itself** — there is no Next 16.2.x that avoids them, and `postcss@8.4.31` was **already present in
the Next 14 tree**, so the upgrade does not introduce it.

Neither is exploitable in this app:
- **postcss** — build-time CSS processing. The advisories need attacker-controlled CSS or CSS
  comments; all CSS here is authored in-repo. No user-supplied CSS exists.
- **sharp/libvips** — used by `next/image`. The advisories need attacker-supplied images; all images
  are static assets in `public/`. There is no upload path.

**Never run `npm audit fix --force` here.** npm's proposed remedy is `next@9.3.3` — a downgrade of
seven majors that would undo this entire step.
- `@supabase/supabase-js` is now **unused by the Next app** (the client was deleted in step 2).
  Remove it from `package.json` as part of this bump.
- **Validate on a preview deploy, not production:** fix the **Preview** env vars first (previews are
  SSO-protected → zero exposure), deploy the branch, validate against the live Supabase project.
  This keeps "did React 19 break it?" separable from "did the env fix break it?".

---

## GO-LIVE RUNBOOK (2026-08-04) — one ordered list

> `SUPABASE_DB_PASSWORD` is **not** needed for any step here. Nothing below touches the
> database schema. Export it only if a migration is added later.

### 1. Merge
```bash
cd "<repo>"
git fetch origin                      # local main is stale — origin/main is ahead
git switch resume-audit
git merge origin/main                 # the two image-rename commits
git merge next16-upgrade              # Next 16 + everything since
git push origin resume-audit
```
**Trap:** if either `merge` reports a conflict, **stop** — do not push. Last checked,
`git merge-tree` showed 0 conflicts, but re-verify rather than assume.

### 2. PR
Open `resume-audit` → `main`, review the diff, merge.
**Nothing goes live yet** — Production still has no Supabase env vars, so the build-time guard
fails the build. That is fail-closed and intended.

### 3. Production env vars — the actual moment of go-live
Vercel → Settings → Environment Variables → tick **Production**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nofzyhxjpsikdhbcpfuo.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the live project's anon key (Supabase → Settings → API) |

Confirm `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `RESEND_API_KEY` are **absent** from
Production.

**Trap:** setting these alone changes nothing — `NEXT_PUBLIC_*` is inlined at compile time.
The site only goes live at step 4. Equally: once they are set, *any* future build goes live
against the real database.

### 4. Force a genuinely fresh build
Merging in step 2 triggers a build. If Production env was set **after** that build, it used the
old (absent) values and will have failed — **that failure is expected.** Trigger a new one:

- Vercel → Deployments → **⋯ → Redeploy**, and **uncheck "Use existing Build Cache"**, or
- push any commit to `main`.

**Verify the build log shows:** `✓ Environment check passed — Supabase project "nofzyhxjpsikdhbcpfuo"`.
If it shows a different ref, the env vars did not save — stop, fix, rebuild.

### 5. End-to-end test — on `https://www.nxtcollect.com` only
A `*.vercel.app` origin is not in the edge function allowlist and will 403.

- [ ] Home page renders; language switcher works
- [ ] Consent line visible above the submit button, with a working Privacy link
- [ ] `/privacy` and `/privacy?lang=de` render correctly
- [ ] **Sign up with a real address you control** → success modal, milestone copy
- [ ] Email arrives from **NextCollect &lt;info@nxtcollect.com&gt;**, signed **Team NextCollect**, no profile image
- [ ] Unsubscribe link → lands on `nxtcollect.com/unsubscribed` in the right language
- [ ] Resend logs show **delivered**, not bounced
- [ ] Leak probe still denied:
      `curl "$URL/rest/v1/nextcollect_registration_records?select=*" -H "apikey: $ANON"` → `42501`
- [ ] Delete the test row so the first real signup is **#1**

### 6. Watch for the first few minutes

| Watch | Where | Healthy |
|---|---|---|
| Signup succeeds | The form itself | Success modal, no console errors |
| Function errors | Supabase → Edge Functions → Logs | No repeated 500s |
| Email delivery | Resend → Logs | `delivered`, **not** bounced or complained |
| The leak | The curl probe above | `42501 permission denied` |
| Traffic shape | Supabase → Logs (API) | Ordinary volume, no burst |

### 7. What should make you roll back

| Symptom | Severity | Action |
|---|---|---|
| **Anon probe returns rows** | **Critical** | Roll back immediately. Should be impossible — policies dropped and grants revoked — but this is the one that cannot wait |
| Signup 5xx repeatedly | High | Roll back the frontend; check edge logs |
| Page does not render / hydration errors | High | Roll back; suspect the Next 16 build |
| Email never arrives | Medium | Do **not** roll back — signups still work. Check Resend logs and domain status |
| First real sends bounce | Medium | Pause promotion, investigate before volume compounds (reputation is slow to undo) |

**How to roll back:** Vercel → Deployments → previous deployment → **Promote to Production**.

**What rollback does and does not undo — important:** it reverts *only the frontend*. Database
changes, the edge function, and Supabase secrets all stay. Rolling back restores the bundle
pointing at the **dead** project, so the site returns to broken-but-not-leaking. That is a safe
fallback, not a fix — and it does not re-open the read leak, because C2 closed that at the
database.

---

## Step 8 — original notes

### Three things that will bite you if the order is wrong

1. **The build-time guard fails any Vercel build until that environment's vars are fixed.**
   `scripts/check-env.mjs` pins `EXPECTED_REF = nofzyhxjpsikdhbcpfuo`. Deploying to Preview before
   fixing the Preview env produces a *failed build*, not a broken site. Working as designed — but
   fix env **before** deploying, every time.
2. **Signup cannot be tested on a Preview URL.** The edge function allowlist is
   `nxtcollect.com` / `www.nxtcollect.com` only, so a `*.vercel.app` origin gets **403**. Under
   D-002 the edge function *is* the signup path, so the whole form fails there — not just the
   email. **Test signup locally instead** (see below); use Preview only to prove it builds and
   renders on Vercel.
3. **A plain redeploy may not pick up new env values.** `NEXT_PUBLIC_*` is inlined at *compile*
   time, so the compile must genuinely re-run.

### Validation order

**A. Test the upgrade locally against the real backend — this is the real end-to-end test.**
```bash
supabase secrets set ALLOW_LOCAL_ORIGIN=true      # temporarily allowlists http://localhost:3000
supabase functions deploy send-confirmation-email # required: the allowlist is evaluated at boot
git switch next16-upgrade
npm ci && npm run build && npm start              # real production build, real Supabase, real Resend
```
Sign up at `http://localhost:3000` with a **real address you control**. Then:
```bash
supabase secrets set ALLOW_LOCAL_ORIGIN=false     # REVERT — do not leave prod accepting localhost
supabase functions deploy send-confirmation-email
```

**B. Preview deploy — build verification only, no signup test.**
Fix **Preview** env vars first, then deploy `next16-upgrade`. Expect the form to 403 on submit;
that is correct behaviour, not a regression.

**C. Go-live.** Merge → fix **Production** env → fresh build → test on the real domain.

**Deploy `next16-upgrade`, not `resume-audit`** — verified: `next16-upgrade` is a strict superset
(one extra commit, nothing missing), so it carries all the deployed backend work too.

**Leave Production env vars until step C.** Fixing them early is harmless *only* while no rebuild
happens — but any push to `main` auto-deploys, which would silently take the new backend live
before validation.

### Forcing a genuinely fresh build

Either:
- **Push a commit** — always produces a clean build. Most reliable.
- Vercel → Deployments → ⋯ → **Redeploy**, and **uncheck "Use existing Build Cache"**.

Do not assume a cached redeploy re-inlines `NEXT_PUBLIC_*`.

---

**Order matters. Do not do this before steps 5a–7 are done.**

1. Vercel → Settings → Environment Variables: set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **live** project across Production/Preview/Development.
2. Delete `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (dead project) and `RESEND_API_KEY`
   (unused by Next; the edge function reads its own copy from Supabase secrets).
3. **Redeploy** — `NEXT_PUBLIC_*` is inlined at build time, so changing the variable alone does
   nothing. The build-time guard (step 3) will now fail the build if the values are wrong.
4. End-to-end signup test on **`https://www.nxtcollect.com`** — *not* a `.vercel.app` URL, those
   are not in the edge function's origin allowlist and will 403.
5. Confirm: row appears, position is **1**, email arrives, and Resend logs show a **delivered**.

### Acceptance criteria for "done"

- [ ] A real visitor can sign up on `www.nxtcollect.com` and receives the confirmation email
- [ ] Anon key still cannot read or write the table (re-run the probe below)
- [ ] Duplicate signup → "already registered", **no position disclosed**
- [ ] Unsubscribe works end-to-end, in the user's language
- [ ] Privacy notice localized at point of collection; policy reachable
- [ ] Build fails if the Supabase env is wrong (`npm run check-env`)

---

## Verification commands

```bash
# Env guard (should pass locally, fail on a wrong project ref)
npm run check-env

# Build
npm ci && npm run build

# Leak still closed — expects 42501 permission denied, NOT rows
set -a; . ./.env; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/nextcollect_registration_records?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# i18n invariant — all six locales must have identical key sets (34 leaves each)
python3 - <<'PY'
import json,glob
def leaves(d,p=''):
    for k,v in d.items():
        yield from (leaves(v,p+k+'.') if isinstance(v,dict) else [p+k])
s={f:set(leaves(json.load(open(f)))) for f in glob.glob('app/i18n/*.json') if ' ' not in f}
base=next(iter(s.values()))
print('OK' if all(v==base for v in s.values()) else 'MISMATCH', len(base),'keys')
PY
```

**Safe to test freely** (these return *before* Resend is called): origin rejection, invalid email,
invalid country, duplicate 409, resend-to-unregistered.
**NOT safe:** a successful signup **sends a real email**. See CLAUDE.md guardrail 15 — three
`@example.invalid` test signups were accepted and sent, producing hard bounces.

---

## ⚠ DEPLOY ORDER — migrations BEFORE functions, always

**This bit people. On 2026-08-04 the migration failed (missing `SUPABASE_DB_PASSWORD` in a
fresh terminal) and the function deploy on the next line succeeded anyway** — leaving a
deployed function calling a database object that did not exist.

The commands are independent: **a failed `db push` does not stop a subsequent
`functions deploy`.** Nothing enforces the order but you.

```bash
export  SUPABASE_DB_PASSWORD='...'   # leading space keeps it out of shell history

supabase db push                     # 1. schema FIRST
#    ↑ if this fails, STOP. Do not run the deploy. Fix the failure and re-run.

supabase functions deploy <name>     # 2. only after the migration succeeded
```

Or chain them so the shell enforces it:
```bash
supabase db push && supabase functions deploy send-confirmation-email
```

**Why it was survivable that time, and why not to rely on that:** the throttle helper fails
*open* — a missing function surfaces as a PostgREST `PGRST202` error object, which
`supabase-js` returns in `error` rather than throwing, so the `if (error)` branch returned 0
and signups continued unthrottled. That is designed behaviour for *this* helper. **A different
call site with no fail-open path would have returned 500 to every user.** Order the commands
correctly rather than depending on each caller being defensive.

## Needs the owner's hands

MCP connectors are read-only by design (CLAUDE.md 14–17). The owner runs:
`supabase db push` · `supabase functions deploy` · any `DELETE`/`UPDATE` · Vercel env changes and
deploys · dashboard settings.

## Open items

| # | Item | Blocks |
|---|---|---|
| 1 | **Controller legal identity** | The privacy policy. A template cannot guess it |
| 2 | Is `info@nxtcollect.com` monitored? | Publishing the erasure route |
| 3 | DPAs accepted with Supabase / Vercel / Resend | Policy accuracy |
| 4 | D-009: make the GitHub repo private | Decided, not yet done |
| 5 | Ordinal reuse after deletion — `COALESCE(MAX(...),0)+1` | Must land **with** the D4 deletion path |
| 6 | Domain reputation: 4 of 7 lifetime sends were a bounce or complaint | Watch after the first real sends |
