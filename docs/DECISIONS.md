# Decisions Record

Architectural decisions for the resume-audit remediation, with the alternatives that were
**considered and rejected**, and why. Written 2026-08-01 on branch `resume-audit`.

**Read this before implementing anything.** Several of these decisions look wrong or
over-built if you only read the code — the reasoning that makes them correct is not
recoverable from the codebase. Where a rejected alternative is the one you would naturally
reach for, it is written down precisely so you do not re-derive it.

Related: [`../CLAUDE.md`](../CLAUDE.md) (guardrails), the remediation plan, and
`audit-2026-08-01.md` (evidence) once written.

---

## D-001 — Signup position comes from the edge function, never an anon-callable RPC

**Status:** Decided · **Owner-directed**

**Context.** The signup form shows "you're #N on the list". Today the client obtains that by
`INSERT ... .select('registration_position')` (`app/components/Hero/index.jsx:166-170`), which
requires an anon `SELECT` policy on `nextcollect_registration_records`. That policy is currently
`USING (true)` — it exposes **every row** to anyone holding the anon key (which ships in the
browser bundle). Anonymous visitors have no identity, so a genuine row-level "own row only"
policy is impossible.

**Decision.** The **existing `send-confirmation-email` edge function** (service role) is the only
trusted path that returns a position. The broad anon `SELECT` policy is dropped.

**Rejected — a `my_position(p_email text)` SECURITY DEFINER RPC callable by anon.**
This was the obvious "keep the feature, lock the table" fix, and it is wrong: a function that
returns a position for any caller-supplied email **is an email-enumeration oracle**. Anyone could
test whether a given address is on the list. That trades a bulk leak for a targeted one.

**Binding constraint that follows:** *position must never be readable for an arbitrary
caller-supplied email.* Any future design must satisfy this. See D-002 for the only design that
fully does.

---

## D-002 — The INSERT moves into the edge function; both anon policies are dropped

**Status:** Decided · **Owner-directed** (explicitly chosen over the cheaper fallback)

**Context.** D-001 removes the anon `SELECT`. The anon `INSERT` policy remains
`WITH CHECK (true)` — unconstrained writes, and the non-empty validation that migration 2
deliberately added was silently lost when migration 5 recreated the table.

**Decision.** The edge function performs the insert with the service role and returns
`{position, emailSent}`. **Both** anon policies are dropped. The anon key can then neither read
nor write the table.

**Why this specific design (not just cost/benefit — it is the only compliant one).** The function
returns a position **only when it performed the insert in that same request**. An
already-registered email returns "already registered" with **no position**. Positions are
therefore never queryable after the fact, which is the only way to satisfy D-001's binding
constraint.

**Rejected — position-only relocation (keep anon INSERT, move just the read).**
Cheaper (~half the work) and closes the bulk dump, but leaves a residual "ask for the position of
a known registered email" vector. **Does not meet the D-001 constraint.** The owner was shown this
trade-off explicitly and chose full relocation.

**Consequences.** Client submit becomes a single fetch; remove the `.insert().select()`. Local dev
requires `supabase functions serve` with `ALLOW_LOCAL_ORIGIN=true`. Server-side validation
(format, length, `country ∈ EUROPEAN_COUNTRIES`) now lives in the edge function and must be
implemented there — dropping the INSERT policy removes the database-level check entirely.

### ✅ Load-bearing assumption — VERIFIED 2026-08-02

This decision assumed Row Level Security is actually ENABLED on
`nextcollect_registration_records` — if it were not, dropping the policies would accomplish
nothing. **Verified against the live database:**

```
SELECT relrowsecurity FROM pg_class WHERE relname='nextcollect_registration_records';
→ relrowsecurity = true      -- RLS is ON. The policy drops will be meaningful.
```

The read leak was also confirmed live: a `GET` with the public anon key returned a full row
(HTTP 200), and Supabase advisor lint 0026 independently flags the same exposure.

### `REVOKE` — ELEVATED to the same tier as the read-leak fix (owner, 2026-08-02)

**This is not defence-in-depth. It is a live data-destruction exposure one toggle away.**

`anon=arwdDxtm` includes **UPDATE, DELETE and TRUNCATE**. Those are blocked today *only* because
no RLS policy exists for those commands. RLS is a single switch — disabled in the dashboard by
accident, or by a future migration, or during debugging — and at that moment the public anon key,
which ships in the browser bundle and sits in a public repository, can `TRUNCATE` the subscriber
table. There is no second layer.

The grants serve no purpose: under D-002 the anon role has no legitimate access to this table at
all. **Do the `REVOKE` in the same change as the policy drops, not as a follow-up.**

### `REVOKE` — supporting detail

Phase A found that `anon` holds **every** table privilege:

```
relacl → anon=arwdDxtm/postgres
         (INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN)
```

**RLS is the only thing restricting `anon` today.** UPDATE and DELETE are blocked solely because
no policies exist for those commands — not because the grants are absent. Therefore, alongside
dropping the policies:

```sql
REVOKE ALL ON nextcollect_registration_records FROM anon;
REVOKE ALL ON nextcollect_registration_records FROM authenticated;  -- advisor lint 0027
```

This removes the dependency on RLS never being toggled off. Safe under D-002: the edge function
connects with the service role, which holds its own grants and bypasses RLS. `authenticated` is
included because it holds identical grants and this project has no auth at all.

*(Note: `information_schema.role_table_grants` returned empty for these roles — that view filters
by current-user visibility and is misleading here. `pg_class.relacl` is authoritative.)*

---

## D-003 — Rate limiting uses a Postgres table; in-memory counters are not viable

**Status:** Decided · **Owner-corrected**

**Context.** The edge function has no rate limiting. The origin allowlist is a **browser** control
only — `curl -H 'Origin: https://nxtcollect.com'` bypasses it entirely. With the public anon key,
anyone can mail-bomb every registered address, burn the Resend quota, and destroy sending
reputation. Under D-002 the edge function becomes the sole write path, which raises the stakes.

**Decision.** A **Postgres throttle table**, with per-IP **and** per-email windows, checked
service-side before insert/send, returning `429` + `Retry-After`.

**Rejected — in-memory / TTL counters inside the edge function.**
This is the "lazy", dependency-free option and it is **incorrect here**: Supabase edge functions
run on **ephemeral, horizontally-scaled Deno isolates**. Counters are not shared between
instances, so an attacker simply gets a fresh bucket per isolate. Recorded explicitly so it is not
re-proposed as a simplification.

**Rejected — Upstash Redis / Deno KV.** Works, but adds a dependency and operational surface for a
coming-soon page. Gold-plating unless volume warrants it. Revisit only if the Postgres table
becomes a measured bottleneck.

**GDPR construction (mandatory, see D-005).** Store a **salted hash of the IP**, never the raw
address, and **purge rows past the window**. The **per-email dimension is also personal data** and
carries the same retention discipline. Lawful basis: abuse/fraud prevention as a legitimate
interest (**GDPR Recital 49**) — defensible without consent, and must be stated in the privacy
policy.

---

## D-004 — Upgrade to Next 16.2.x + React 19, in a separate branch, ranked as security

**Status:** Decided · **Owner-directed**

**Context.** The project runs Next **14.2.33**. Next.js 14 reached **End of Life on 26 Oct 2025**
and receives **no security patches**. The July 2026 security release fixed **4 high** (including a
DoS and a middleware/proxy bypass) **+ 5 medium** severity issues, shipped in **15.5.21 and
16.2.11 only**. This project is unpatched against them.

**Decision.** Target **Next 16.2.x (Active LTS) + React 19** and matching `@types`. Pin to the
**latest patched 16.2.x at the time the work is done** — ≥16.2.11 carries the July 2026 fixes;
**verify the current patch level rather than assuming**. Done in its **own branch and PR**, but
ranked as **security work, not deferred polish**.

**Rejected — stay on Next 14.x and only bump `@supabase/supabase-js`.**
This was the owner's initial preference (low risk for a working launch page) and was **reversed on
evidence**: the choice was explicitly conditional on Next 14 still receiving security patches. It
does not. The condition fired.

**Rejected — Next 15.5.x.** One-major jump, smaller diff — but 15.x is Maintenance LTS ending
**21 Oct 2026**, under three months out, so the migration would be repeated within the year. Both
targets require React 19, so migration cost is identical; pick the one with runway.

**Sequencing.** Cut **after** the security fixes merge, then rebase. Both this and D-002 modify
`app/components/Hero/index.jsx` (submit-handler region) — a real but small overlap once ordered.
Security work and a framework migration must never share a change set.

### AMENDED 2026-08-02 — moved INTO the launch list, and the justification corrected

**Moved to the last step before go-live** (owner). The site is dark (D-012), which is the cheapest
window this migration will ever get: a React 19 regression costs nothing now and costs real signups
after launch.

**The stated justification was corrected.** Exposure to the July 2026 CVEs is **near-zero for this
specific app**, verified by inspection: **no middleware** (so the middleware/proxy-bypass class has
no attack surface at all), no API routes, no route handlers, no server actions, no dynamic route
segments. `app/` is a single statically-renderable page with client-side Supabase calls and no
auth. The DoS-via-CPU class requires a server-side path processing attacker-controlled input, and
none exists. *(Caveat: this reasons from the release summary, not per-CVE detail. The middleware
conclusion is solid; the DoS one is high-confidence inference.)*

**So the reason to upgrade is EOL, not those CVEs.** Next 14 will never receive another patch —
the risk is every *future* vulnerability, permanently unfixed.

**Migration size, measured:** zero occurrences of every classic React 19 breaking change
(`propTypes`, `defaultProps`, `ReactDOM.render`, `findDOMNode`, `forwardRef`, string refs, legacy
context). Next 15's headline change — async `cookies`/`headers`/`params`/`searchParams` — is
entirely unused. The client boundary is already correct. Migration-sensitive surface: 6 `next/*`
imports across 5 files. **Most likely breakage:** `Section/index.jsx:60` sends an **SVG through
`next/image`** with no `images` config and no `dangerouslyAllowSVG`; Next 16 tightened image
defaults.

**TRIPWIRE (consequence of the corrected justification).** Because this is not security-urgent, it
**must not block go-live**. If it is not cleanly done and regression-passed within the intended
window, ship on Next 14 and migrate in a scheduled dark window afterwards. A working site on an EOL
framework beats a dark site on a supported one.

---

## D-005 — GDPR affordances are launch conditions, not polish

**Status:** Decided · **Owner-directed** (re-tiered from the original plan)

**Context.** A grep of `app/` and all six i18n files for
`privacy|consent|terms|gdpr|unsubscribe|opt-in|cookie` returns **zero hits**. The form collects
email + country with no consent checkbox, no privacy notice and no privacy-policy link; the footer
is copyright + social only; the confirmation email has no unsubscribe. This is an EU-facing form,
an EU-region database (North EU / Stockholm), six European languages — and D-003 will introduce
IP-derived data.

**Decision.** Privacy policy, consent/lawful basis at point of collection, unsubscribe
(`List-Unsubscribe` **plus** a working mechanism), and a documented deletion path are **blocking
launch conditions**, at the same tier as the security fixes.

**Rejected — treating these as Tier-3 polish** (the original plan's position). Wrong for this
jurisdiction and data profile. Corrected by the owner.

**Consequence.** All privacy copy must be translated into all six languages — budget for it.

---

## D-006 — Finish the existing design system; do not build a new one

**Status:** Decided

**Context.** The concern was that the site might read as "vibe-coded" — values chosen per
component rather than from rules. Investigation found the opposite: a real system **exists** in
`app/styles/tokens.css:19-42` (spacing scale, radius scale, color roles, two shadow tokens), and
inputs are internally consistent. The build has drifted off it in specific, enumerable places:
hardcoded hover colors, hand-rolled shadows while `--shadow-soft`/`--shadow-strong` sit unused,
off-scale radii, `--color-primary` re-encoded numerically as `rgba(71,15,244,…)`, and no type
scale.

**Decision.** Close the drift — a hover-color role token, use the existing shadow tokens, snap
off-scale radii, reference the primary token, optionally add a small type scale. The site is
roughly **80% coherent**; the work is finishing, not founding.

**Rejected — building out a fuller design system.** Breakpoint tokens, a shadow-elevation system,
a component library, dark-mode theming and motion tokens are **out of scope** for a one-page
coming-soon site. The goal is coherence, not a design system for a product suite.

**Note.** The missing `:focus-visible` on `.submitButton` (`Hero/styles.module.css:184-201`) is
classified as an **accessibility defect, not design polish** — keyboard users get no focus
indication on the primary action while inputs do. It is a must-fix.

---

## D-007 — Applied migrations are never deleted; they are reversed by a new forward migration

**Status:** Decided · **Owner-caught error in the original plan**

**Context.** `supabase/migrations/20260314223534_fix_count_estimate_search_path.sql` creates a
`SECURITY DEFINER` function that concatenates caller-supplied text into `EXECUTE 'EXPLAIN ' ||
query` with no `REVOKE`, making it a potential arbitrary-SQL-as-owner primitive reachable via
PostgREST RPC. It must go. The original plan said "delete the migration file; if already applied,
`DROP FUNCTION`" — **two incompatible paths stated as one.**

**Decision.** Handling depends on remote state:
- **Not applied / never pushed** → delete the file. Clean.
- **Applied** → **do not delete the file.** Deleting an applied migration permanently desyncs local
  history from the remote `supabase_migrations.schema_migrations` ledger. Add a **new forward
  migration** containing `DROP FUNCTION IF EXISTS public.count_estimate(text);` and push that.

**Critical detail — check the function, not the migration.** In this repository
`count_estimate` appears **only** in that migration (verified with `git log -S`), as
`CREATE OR REPLACE`. But the migration's own comment references a pre-existing
`pg_temp_22.count_estimate` advisor warning, implying a version was created on the remote
**outside migrations** (likely by Supabase Studio tooling). Therefore the remote check is
**"does `public.count_estimate` exist and can `anon` EXECUTE it?"** — *not* "was this migration
applied." **The remote `DROP` is required regardless of what happens to the file**; deleting the
migration does nothing to a manually-created function.

**Rejected — `REVOKE EXECUTE FROM PUBLIC` instead of dropping.** The laziest patch, but the
function has no caller anywhere in the codebase, and the advisor warning it was written to silence
concerned a *different, transient* temp-schema object. Dropping is both simpler long-term and
safer.

### ✅ RESOLVED by Phase A verification (2026-08-02)

The remote was checked directly. **The function does not exist and the migration was never
applied:**

```
SELECT ... FROM pg_proc WHERE proname='count_estimate';       → 0 rows
POST /rest/v1/rpc/count_estimate                              → HTTP 404 (PGRST202)
list_migrations                                               → []  (ledger absent entirely)
get_advisors('security')                                      → no mutable-search_path warning
```

There are **no** `SECURITY DEFINER` functions in `public` at all. The advisor warning this
migration was written to silence **does not exist today** — it was solving a phantom.

**Therefore the "not applied" branch applies: simply delete the migration file.** No remote
`DROP` is required, and the earlier concern about desyncing the ledger is moot here.

**But the general rule in this decision still stands** for every future migration — with an
important amendment discovered in the same pass: **there is no migration ledger at all**
(`supabase_migrations` schema does not exist), so nothing has ever been applied via the CLI and
the live schema was hand-built. `supabase db push` would try to replay all six migrations against
an existing schema and abort on `CREATE POLICY` (which has no `IF NOT EXISTS`). The ledger must be
baselined before any migration-based change can ship. Tracked as **C-OPS** in `PLAN.md`.

---

## D-008 — Export the subscriber table before any database change

**Status:** Decided · **Owner-caught omission**

**Context.** The plan performs live database surgery (dropping policies, dropping a function,
relocating writes) on a table holding **real subscriber signups**, with no backup step. No planned
change deletes rows, so there is no structural data-loss path — but operator error on a live
database is a real risk, and the project's backup posture (plan tier, PITR availability) could not
be verified.

**Decision.** A **pre-flight export is a hard gate** before the first database change:
`supabase db dump --data-only -t nextcollect_registration_records`, or a dashboard CSV export.
Stored outside the repository.

**Note.** Commit `8ee91f0` is the code rollback point. **Code rollback does not undo database
changes** — which is exactly why the export is separate and mandatory.

---

## D-009 — `.env` in git history, and repository visibility — **DECIDED 2026-08-02**

**Status: Decided · Owner-directed.**

**Decision, three parts:**
1. **Do NOT rotate the anon key.** It is public by design — it ships in the browser bundle. Rotation
   accomplishes nothing against an exposure that was never a secret. The exploitable part was the
   `USING (true)` policy (C2), not the key.
2. **Do NOT rewrite git history.** Disruptive (forced pushes, invalidated clones) for low value,
   given (1).
3. **DO make the GitHub repository private.** Free, reversible, and it removes casual discovery of
   the schema, migration files, edge-function source and endpoint structure.

**⚠ Caveat that must not be lost: assume the repository has already been cloned and indexed.**
Making it private stops *future* exposure; it does **not** undo past exposure. Anything that was
public — schema shape, endpoint paths, the anon key — should be treated as already known to third
parties. Do not let "it's private now" become a reason to skip C2, C3 or the `REVOKE`; those remain
the real fixes.

**What is in history.** `.env` was committed and removed twice — added at `3f6e53e` ("Start
repository"), deleted at `dfbbb52`, re-added at `1b79a34`, deleted again at `818e015`. The blobs
remain reachable in history. Variable names present: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The `VITE_*` pair is dead residue from
an earlier scaffold. **`RESEND_API_KEY` was never committed.** The current `.env` is correctly
gitignored and untracked.

**Why the blast radius is limited.** These are **anon/public** Supabase keys, not service-role keys.
The anon key is designed to ship in the browser bundle — it is public by definition and was never a
security boundary. **The exploitable part was the `USING (true)` RLS policy, not the key's presence
in history.** Fixing RLS (D-001/D-002) is the actual fix; rotating the key without fixing RLS would
accomplish nothing.

**Options.**
1. **Rotate the anon key** — cheap and clean. Requires updating the Vercel env var and local `.env`.
   Mainly hygiene, since D-002 removes anon's access to the table anyway.
2. **Accept and document** — defensible given the limited blast radius, provided D-001/D-002 land.
3. **Rewrite history** — only if the owner wants the `VITE_*` residue and old blobs gone entirely.
   Disruptive (forced pushes, invalidated clones); not warranted by the risk alone.

**Related hygiene, also not yet decided:** `.gitignore` covers `.env`, `.env.local` and
`.env.*.local`, but **not** `.env.example`, `.env.production` or `.env.development` — a future
`.env.production` would be committed silently. Consider `.env*` with `!.env.example`.

### ⚠ NEW INPUT from Phase A (2026-08-02) — the repository is PUBLIC

Vercel reports `githubRepoVisibility: "public"` for `Nextcollect/NextCollect-ComingSoonPage`.
**The historical `.env` blobs are therefore world-readable, not merely visible to collaborators.**

This does not change the technical blast radius — the keys are anon/public keys that ship in the
browser bundle regardless — but it does change the practical picture, and it raises the stakes of
the **live read leak (C2)**: anyone can read the repo, recover the anon key from history *or* from
the bundle, and dump the table today. Fixing C2 remains the actual fix; key rotation alone would
still accomplish nothing.

**Still OPEN, still the owner's call.** Two things worth deciding together now:
1. Whether to rotate the anon key (hygiene) — unchanged from the options above.
2. **Whether the repository should be public at all.** That is a separate decision the owner has
   not been asked before; flagging it rather than assuming either way.

---

## D-012 — Production points at a DEAD Supabase project; signup has never worked

**Status:** Discovered 2026-08-02 during post-deploy testing. **Not a decision — a discovered
outage.** This is the most business-critical finding of the entire audit and it is not a security
issue.

**Symptom.** A real signup on `https://www.nxtcollect.com` fails with
`net::ERR_NAME_NOT_RESOLVED` and the form shows "There was an issue with this entry."

**Root cause, proven.** The production JavaScript bundle
(`/_next/static/chunks/app/page-*.js`) has a **different Supabase project baked into it**:

| | Project ref | DNS |
|---|---|---|
| Production bundle (Vercel) | `uvlprdktzayskmcwxcye` | **NXDOMAIN — does not exist** |
| Local `.env` (correct) | `nofzyhxjpsikdhbcpfuo` | resolves, live |

The **anon keys differ too** (sha1 `66bd89bbf3db` vs `11fa2c4f3fa5`), so this is a complete,
self-consistent pointer to a dead **Bolt-era** project — not a partial mix-up. Both
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel are wrong.

**Duration: since the first deployment.** Vercel env vars are 148 days old (≈2026-03-07); the first
deployment was 2026-03-07 and the current production deployment is 2026-03-10. **Production signup
has never worked — roughly five months.** Corroborating evidence, all previously misread as
"the site is dormant": 1 table row, zero edge-function invocations, no signup API traffic, and 4
Resend emails all addressed to the owner's own two addresses. The single 2026-03-14 row came from
**local dev** (correct `.env`), not production — the then-deployed function had
`Access-Control-Allow-Origin: "*"` and no origin check, so `localhost` reached it.

**This was NOT caused by the C0/C4 edge-function deploy.** That deploy touched only
`supabase/functions/send-confirmation-email`. The failure is a client-side DNS error on the
Supabase REST insert, originating in a Vercel static asset built five months earlier. A Supabase
function deploy cannot modify a Vercel bundle. **Do not roll back C0** — rolling back would
reintroduce the open relay without fixing anything.

### Dead-project sweep (2026-08-02) — where the contamination reaches

Checked: repo source, git history, Vercel env, Resend, Supabase secrets, DNS.

- **Three** Supabase project refs have existed. Two are **NXDOMAIN (deleted, unrecoverable —
  a *paused* Supabase project still resolves; these do not):**
  | Ref | Held by | DNS |
  |---|---|---|
  | `0ec90b57d6e95fcbda19832f` | `VITE_SUPABASE_URL` (Bolt era) | NXDOMAIN |
  | `uvlprdktzayskmcwxcye` | `NEXT_PUBLIC_SUPABASE_URL` (still in Vercel) | NXDOMAIN |
  | `nofzyhxjpsikdhbcpfuo` | local `.env`, live project | **resolves** |
- **Repo source is clean** — no hardcoded ref anywhere in `app/` or `supabase/`; `VITE_*` appears
  only as env residue, never read by code. The edge function uses platform-injected `SUPABASE_URL`.
- **Resend is clean and unaffected** — 0 webhooks, 1 API key (created 2026-03-10). Resend is scoped
  to the *domain*, not to a Supabase project, so there is no cross-contamination. SPF/DKIM live on
  `nxtcollect.com` DNS, independent of Supabase.
- **Contamination is confined to exactly two places: the five Vercel env vars, and the `.env` blobs
  in git history.** Nothing else points at a dead project.

**Consequence for D-009 — the decision was right, and now for a stronger reason.** The anon keys in
git history belong to the **dead** projects (sha1 `d9a6baabad28`, `e325181f1e41`) and do **not**
match the live project's key (`11fa2c4f3fa5`). **There is nothing to rotate — those credentials
authenticate against projects that no longer exist.** "Do not rotate" moves from *defensible* to
*obviously correct*. Making the repo private remains worthwhile for schema/endpoint discovery, but
its urgency drops further.

### ⚠ Sequencing consequence — read before fixing the URL

**The C2 read leak is currently inert in production** because the public bundle points at a
project that does not exist. **Fixing the URL activates the real leak**: the moment production
points at `nofzyhxjpsikdhbcpfuo`, the live `USING (true)` policy and anon's full table grants
become reachable from every visitor's browser.

**Therefore: land C2 (drop both policies) and the `REVOKE` BEFORE, or in the same change as, the
Vercel env fix.** Going from "broken but not leaking" straight to "working and leaking" would be a
self-inflicted regression.

**Also note:** `NEXT_PUBLIC_*` values are **inlined at build time**. Changing the Vercel
environment variable alone does nothing — the project must be **redeployed/rebuilt** for the new
value to reach the bundle.

### Confidence: what is airtight and what is not

**Airtight — production is broken now and has been since at least 2026-03-10:**
the live bundle was scraped directly and carries `uvlprdktzayskmcwxcye`, which returns NXDOMAIN.
This is direct evidence, not inference.

**Strongly supported but NOT airtight — "it has *never* worked":**
- Supporting: all five Vercel env vars show the same 148-day age (≈2026-03-07); all three known
  deployments (2026-03-07, 2026-03-10 ×2) postdate that; zero edge-function invocations; no signup
  API traffic.
- **Loose threads, stated honestly:**
  1. The position sequence stands at **6** while only **1** row exists — five sequence values were
     consumed by inserts that were later deleted or failed. Some signup activity is unaccounted for.
  2. **4 Resend emails but only 1 matching row.** The 2026-03-10 and 2026-03-12 sends have no
     surviving row. Both are explainable — the *then-deployed* function had no registered-email
     check, so it would email anyone, and local dev used the correct `.env` — but neither is proven.
  3. Deployments **older than 2026-03-07 were not enumerated** (the Vercel MCP token expired
     mid-check).
  4. The "148d" figure is read as creation age; if Vercel reports last-*updated*, an earlier correct
     value cannot be excluded from this data alone.

**To close it:** re-authorise the Vercel MCP, list deployments before 2026-03-07, and check the env
vars' actual `updatedAt`. Until then, state it as *"broken since at least 2026-03-10, most likely
from the start."*

---

## D-013 — Consent by submission, and NO cookie banner for the locale preference

**Status:** Decided · **Owner-directed 2026-08-02**

### Consent mechanism: submission-as-consent with a localized notice

No tick-box. A clear notice **above** the submit button, translated into all six languages,
stating what will be sent. The email *is* the service being requested, so a checkbox adds friction
for no real gain.

**This is sound under GDPR.** Recital 32 accepts "another statement or conduct which clearly
indicates acceptance" — submitting a form is a clear affirmative act, and consent here is not
bundled with any secondary purpose.

**But it constrains what may be sent later, and that constraint must not be lost.** This consent
covers *the launch announcement the user signed up for*. It does **not** cover newsletters, product
updates, or offers. Sending those requires **fresh consent**. The notice must therefore say
precisely what will be sent, and the consent wording version + timestamp must be recorded so what
was agreed is provable.

**Rejected — a tick-box.** More conservative, and defensible, but it suppresses conversion on a
waitlist whose entire purpose is to be emailed. Not required by GDPR for this narrow, unbundled
purpose.

### No cookie banner for the `localStorage` locale preference

E2 will persist the chosen language in `localStorage`. That is storage on terminal equipment under
the ePrivacy Directive, so the reflex is to add a consent banner. **Do not.**

A language preference stored because the user actively chose that language is **strictly necessary
for a service the user requested**, which is the standard exemption. Adding a banner would be
cargo-cult compliance: it would degrade the experience of every visitor, imply the site does
tracking it does not do, and protect nobody.

For the avoidance of doubt about *why* this is safe here: the site sets **no** advertising or
analytics storage of any kind. There is no analytics package, and Resend open/click tracking is
**off** — keep it off. Mention the locale storage in the privacy policy; do not gate it.

**Recorded explicitly so a future reviewer does not "fix" this out of caution.**

---

## D-011 — Never mark our own transactional email as spam

**Status:** Decided · **Owner-directed 2026-08-02**

**Context.** Resend shows **4 emails ever sent**, all to the owner's own addresses during testing —
and **1 of the 4 is `complained`** (marked as spam). On a domain with essentially no positive
sending history, a 25% complaint rate is a genuine reputation signal to mailbox providers,
regardless of it being self-inflicted during testing.

**Decision.** Do not mark NextCollect's own transactional mail as spam. To remove a test message,
delete it. Complaint rate is a durable domain-reputation metric — it does not reset when the test
ends, and it directly threatens deliverability at launch, which is this site's entire function.

**Related:** `List-Unsubscribe` (D3 in `PLAN.md`) is the standard mitigation and is already a
required launch condition — a working unsubscribe gives recipients an alternative to the spam
button. Resend open/click tracking is currently **off**; keep it off (GDPR advantage).

---

## D-010 — Production and the repository have diverged; production is the source of truth

**Status:** Recorded 2026-08-02 from Phase A verification. **Not a choice — a discovered fact**
that invalidates reasoning from the code alone.

Three independent divergences were found:

1. **The deployed edge function is the pre-hardening version** (v3, ~2026-03-10). Production still
   has `Access-Control-Allow-Origin: "*"`, no runtime validation, raw `${registrationPosition}`
   interpolated into email HTML, unresolved `{{placeholder}}` tokens, and **no registered-email
   check — i.e. an open relay** that will send NextCollect-branded mail to any address supplied.
   Every one of these is fixed *in the repo* and unfixed *in production*. `verify_jwt: true` is not
   a mitigation: the anon key is a valid JWT and is public.
2. **The live INSERT policy is not what migration 5 says.** Production enforces the non-empty
   `email`/`country` check from migration 2; the repo's migration 5 says `WITH CHECK (true)`. The
   regression exists only in the files.
3. **There is no migration ledger.** `supabase_migrations` does not exist; nothing was ever applied
   via the CLI. The live schema was built by hand.

**Consequence for anyone working here:** *do not infer production state from the repository.*
Verify with the read-only Supabase MCP (`get_edge_function`, `execute_sql` against `pg_policies` /
`pg_class`, `list_migrations`) before assuming a fix is live. The prior-audit reconciliation table
in `PLAN.md` describes **repo** state only.

---

## Verification status caveat

**Phase A verification completed 2026-08-02** via read-only MCP (Supabase, Resend, Vercel) plus a
production probe run after the D-008 export. D-002's RLS assumption is **confirmed**; D-007's
`count_estimate` concern is **resolved** (absent, never applied); Resend domain auth is
**verified healthy**; Vercel preview deploys are **not** publicly reachable. D-009 gained a new
input (public repository). D-010 records the repo/production divergence.

**One gap remains:** the Vercel MCP exposes no environment-variable listing tool, so **env var
names and Production/Preview parity are still unverified**. Run `vercel env ls` (names only, never
values) or check the dashboard before treating the env configuration as sound.
