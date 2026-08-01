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

## Verification status caveat

Decisions D-001, D-002, D-003 and D-007 were made against **code evidence** (files read directly).
The **live remote state** — whether `count_estimate` exists on the remote, whether the anon
policies are active, Resend domain authentication, and Vercel environment configuration — was
**not verifiable** at the time of writing (no Supabase DB password, no Vercel CLI, no Resend
access). Severity rankings that depend on live state are marked `UNVERIFIED — pending Phase A` in
the plan. Confirm before acting, and update this record if reality differs.
