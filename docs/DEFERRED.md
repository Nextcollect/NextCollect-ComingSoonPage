# Everything deferred, downgraded, or decided against

One place to check that nothing was quietly parked. Compiled 2026-08-03, before go-live.
**Ordered by what I would actually do first if given another day** — not by when it came up.

Effort key: **XS** <30 min · **S** ~1–2 h · **M** ~half a day · **L** ~a day+

---

## Tier 1 — I think you are wrong to skip these

### ~~1.1 Confirm `info@nxtcollect.com` is monitored~~ — ✅ CLOSED 2026-08-04
Owner confirms it is their own mailbox, owned and read. **The deletion route in the privacy
notice is real.** Consequence: hard deletes will now actually happen, which is what forced the
ordinal fix below out of "deferred" and into this change set.

### ~~1.2 C3 rate limiting~~ — ✅ DONE 2026-08-04
### ~~1.3 G4 contrast~~ · ~~1.4 G1 focus-visible~~ — ✅ DONE 2026-08-04
Placeholder 2.35:1 → **4.68:1**; resend error 3.51:1 → **4.94:1**; submit button now has a
visible focus ring. Ratios computed, not eyeballed.

### Original entries, retained for reasoning

#### 1.1 Confirm `info@nxtcollect.com` is monitored — **BLOCKING**
*Risk if left: the privacy notice contains a false statement.* It is now the **only** deletion
route and the only contact. If nobody reads it, the notice promises a right the user cannot
exercise, and that is the one thing in this whole scope reduction that would be a straight lie
rather than an omission. **Effort XS** — send a test and see if anyone gets it.

### 1.2 C3 — rate limiting on the edge function
*Risk if left: **actively exploitable today.*** The open relay is closed (C0 verified), so nobody
can send to arbitrary addresses. But **anyone holding the public anon key can still hammer signup
and resend**. On a domain where 4 of 7 lifetime sends were a bounce or complaint, a modest mail
run would finish off the sending reputation, and Resend quota is finite.

This is the only deferred item that is exploitable rather than merely untidy. Design is already
decided (D-003): Postgres throttle table, hashed IP, purge past window, Recital 49 basis.
**Effort S–M.** *If you do one thing from this list beyond 1.1, do this.*

### 1.3 G4 — contrast failures
*Risk if left: some users genuinely cannot read the form.* `.emailInput::placeholder` `#9e9e9e`
on `--white` is **≈2.3:1**, and the inline `color:'red'` resend error is **≈3.4:1** — both fail
the 4.5:1 minimum. Placeholder text is where people look to understand the field.
**Effort XS.** Two colour values.

### 1.4 G1 — `.submitButton` has no `:focus-visible`
*Risk if left: keyboard users cannot see where they are on the primary action.* Inputs have a
focus ring; the submit button does not. **Effort XS.** Already classified as a11y, not polish
(D-006).

---

## Tier 2 — real, and I would do them before launch if there is time

### 2.1 E1 — missing `og-image.png` (and `favicon.ico`)
*Risk: every share of the launch link renders a broken preview.* `layout.jsx:24,36` reference an
image that does not exist. For a launch announcement people are meant to share, this is the
wrong week to have broken previews. **Effort XS** once an image exists.

### 2.2 Make the GitHub repository private — **decided in D-009, never done**
*Risk: schema, migrations, edge-function source and endpoint structure stay publicly readable.*
Free and reversible. Note the caveat already recorded: it stops **future** exposure only; assume
anything already public has been cloned. **Effort XS.**

### 2.3 E2 — locale is not persisted, and is actively overridden
*Risk: a real UX bug users will hit immediately.* `Navbar/index.jsx:26-33` overwrites the chosen
language with `navigator.language` on mount, so a Dutch-browser user who picks English gets Dutch
back on refresh. **Effort S.** Persist to `localStorage`, seed from `navigator.language` only when
nothing is stored. No cookie banner needed (D-013).

### 2.4 `Test_`-prefixed assets shipping to real users
*Risk: reads as unfinished.* `Test_on_the_list_v03.png` is in every confirmation email;
`Test_header_Image.png` is on the site **and used twice for two different things** (hero and
about). **Effort S** — rename, and give the About section its own image.

### 2.5 F1 — four orphan space-prefixed i18n files
*Risk: a translator edits `" de.json"` and nothing happens.* Tracked in git, imported by nothing,
holding older differently-worded translations. **Effort XS** — delete.

---

## Tier 3 — worth doing, no urgency

| # | Item | Risk if left | Effort |
|---|---|---|---|
| 3.1 | **F6** lint + smoke tests | No safety net at all; nothing catches a regression | S |
| 3.2 | **E4** `<html lang>` is `en` in SSR, corrected client-side | Crawlers and non-JS see the wrong language | S |
| 3.3 | **G2** dropdown keyboard nav — no arrows, Escape does not close | Keyboard users can open it but not drive it well | S–M |
| 3.4 | **G3** focus not restored on modal close; validation uses `role="status"` not `alert` | Screen-reader users lose their place | S |
| 3.5 | **G5/G6** skip link; decorative `alt` duplicating adjacent headings | Minor a11y friction | XS |
| 3.6 | **F5** country list now duplicated in **three** places (client, edge fn, DB CHECK); milestones in two; scroll logic in two | Silent drift | S |
| 3.7 | **F4** README badly stale — wrong primary colour, phantom files, "Protech" | Misleads the next reader | S |
| 3.8 | **F2** Bolt residue: `.bolt/ignore`, empty `app/lib/`, `tsconfig.tsbuildinfo` | Clutter | XS |
| 3.9 | **E6** `tsconfig.json` references two non-existent files | Confusing, harmless | XS |
| 3.10 | **F3** unused assets: `frame.svg`, `vector.svg`, `right-1.png`, `social-media---menu-icons.svg` | Dead weight | XS |
| 3.11 | **F7** `SocialMedia` imported but never rendered in Hero | Dead import | XS |
| 3.12 | **G7–G11** design coherence: hover token, use the unused shadow tokens, snap off-scale radii, reference `--color-primary`, type scale | Drift accumulates | S |
| 3.13 | Legacy Supabase API key migration (`sb_publishable_`/`sb_secret_`) | Legacy keys **deleted end of 2026** — hard deadline. Must update `check-env.mjs` in the same change or the consistency check vanishes silently | M |
| 3.14 | DMARC is `p=none` | Anyone can spoof the domain; tightening while deliverability is shaky is riskier than waiting | S |
| 3.15 | Rotate Resend key + Supabase DB password again | Both entered shell history in plaintext. Local only, not disclosure | XS |
| 3.16 | Confirm the WhatsApp invite link is permanent | It is in **every** email; if it expires, every email ever sent has a dead CTA | XS |
| 3.17 | DPAs with Supabase / Vercel / Resend | Moot under the reduced GDPR scope; matters if this becomes real | XS |

---

## Downgraded after verification — recorded so nobody re-escalates them

| Item | Was | Now | Why |
|---|---|---|---|
| **C1** `count_estimate` arbitrary-SQL RPC | Critical | **Non-issue** | Function does not exist, was never applied, and the advisor warning it targeted is absent. It was solving a phantom |
| **C5** lost INSERT validation | Medium | **Already correct in production** | The live policy has the non-empty check; the regression existed only in the repo files |
| **Next 16 CVE exposure** | "Must fix before anyone visits" | **Near-zero** | No middleware, no API routes, no server actions, no dynamic segments. EOL is the real reason to upgrade, not those CVEs |
| **npm audit 3 highs** (postcss, sharp) | Alarming | **Not exploitable** | Next's own transitive deps; postcss was already in the Next 14 tree. Both need attacker-supplied CSS or images, neither of which this app accepts. **Never run `audit fix --force`** — it proposes `next@9.3.3` |
| **C2 read leak severity** | "Complete mailing-list dump" | **Overstated by me** | 1 test row, and production could not even reach the project. The defect was real; the exposure was not |
| **D-009 `.env` in history** | Rotate keys? | **Nothing to rotate** | The keys in history belong to the two dead projects |

---

## Decided against — with the reasoning, so they are not re-proposed

| Rejected | Instead | Why |
|---|---|---|
| `my_position(email)` anon RPC | Position from the edge function | Email-enumeration oracle (D-001) |
| Position-only relocation (keep anon INSERT) | Full relocation | Left a residual "position for a known address" vector (D-002) |
| In-memory / TTL rate limit counters | Postgres throttle table | Edge functions run on ephemeral horizontally-scaled isolates — an attacker gets a fresh bucket per isolate (D-003) |
| Upstash Redis / Deno KV | Postgres table | Dependency and ops surface not warranted at this volume (D-003) |
| Next 15.5.x | Next 16.2.x | 15.x Maintenance LTS ends 21 Oct 2026 — same migration cost, no runway (D-004) |
| Rotating the anon key / rewriting git history | Make the repo private | Anon keys are public by design, and the historical ones are for dead projects (D-009) |
| `migration repair` on all six old migrations | One honest baseline | Would have encoded a ledger asserting six files were applied that never ran and contradict production (C-OPS) |
| `REVOKE EXECUTE` instead of dropping `count_estimate` | Delete it | No caller anywhere; deletion is both lazier and safer (D-007) |
| Tick-box consent | Submission-as-consent + notice | Friction with no gain for an unbundled, single-purpose waitlist (D-013) |
| Cookie banner for the `localStorage` locale | No banner | Strictly-necessary storage; a banner would be cargo-cult compliance (D-013) |
| Self-hosting the dotlottie player | Delete it, use inline SVG + CSS | Removed **two** third-party data flows instead of hosting one |
| Allowlisting the Vercel preview origin | Test signup locally | Would have needed two extra deploys and risked leaving the allowlist permanently widened |

---

## Open questions never resolved

| # | Question | Blocks |
|---|---|---|
| 1 | Is `info@nxtcollect.com` monitored? | **The privacy notice's accuracy.** See 1.1 |
| 2 | Is the WhatsApp invite link permanent? | Every email's CTA |
| ~~3~~ | ~~Ordinal reuse after deletion~~ — ✅ **DONE 2026-08-04**. Confirming the mailbox made the deletion route live, so this stopped being deferrable. Now `MAX+1` | — |
| 4 | Retention enforcement | Now moot — the notice says "until we've sent the launch announcement", with no dated promise to keep |

---

## GDPR: what the full version would have had, and this one does not

Recorded under D-005's downgrade. **This is an omission, not a misstatement** — nothing in the
notice is false, but a user gets less than a formal policy would give them.

| Missing | Consequence |
|---|---|
| **Controller identity + postal address** | **A user cannot tell who is legally responsible for their data.** The single biggest gap |
| Supervisory-authority complaint route (Art. 13(2)(d)) | A user who wants to complain has no stated route |
| Explicit rights enumeration (access, rectification, portability, objection) | Access and deletion are offered in plain language; the others are not named |
| International-transfer safeguards | Vercel and Resend are US companies even with EU regions |
| Signed DPAs with the three processors | Not evidenced |
| Six-language translation of the policy itself | Notice is translated; a formal policy would need the same |

**What it does have, and this is the part that matters most:** consent captured at the point it
happens, in the user's own language, stating exactly what will be sent — plus a working
unsubscribe, an honest distinction between unsubscribe and deletion, and genuinely minimal data
collection with no tracking.

`GDPR-INVENTORY.md` §3 still holds the complete factual input, so upgrading later does not mean
redoing the expensive part.
