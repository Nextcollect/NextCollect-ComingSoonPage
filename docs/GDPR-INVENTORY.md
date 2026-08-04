# GDPR — scope split and data inventory

Two jobs in one file:

1. **The split** — what can be produced in-house versus what needs a template or a lawyer.
2. **The factual inventory** — the input a template generator or lawyer needs. This is the part
   that is genuinely hard to assemble and easy to get wrong, and it is complete below.

Context: pre-launch waitlist collecting **email + country only**. EU-facing, EU-region database,
six European languages. Not legal advice. See `PLAN.md` → Phase D and `DECISIONS.md` → D-005.

---

## 1. The split — where the line honestly falls

### Safe to produce in-house (no lawyer needed)

These describe *our own behaviour* or are pure engineering. Getting them wrong is a bug, not a
legal misrepresentation.

| Item | Why it is safe |
|---|---|
| **Consent wording at point of collection** | A short factual sentence about what happens when you submit the form. Must be accurate, not lawyerly |
| **Unsubscribe mechanism** | `List-Unsubscribe` + `List-Unsubscribe-Post` headers, one-click endpoint, token scheme, suppression handling |
| **Deletion flow** | How an erasure request arrives, is verified, and is executed end to end |
| **Consent record** | Columns storing what was agreed, when, and the wording version |
| **Throttle retention** | Salted IP hash + purge window (C3) |
| **Plain-text email alternative** | Deliverability and accessibility |
| **This inventory** | Factual assembly, which is most of the work |

### Needs a template or a lawyer — do NOT hand-write

**The privacy policy prose itself.** Not because it is long, but because it is a legal
representation to data subjects and regulators, and errors create liability. Specifically it must
correctly state:

- **The controller's legal identity** — registered entity name, address, contact. *(See open
  question 1: it is not clear NextCollect is a registered entity yet. A privacy policy naming a
  non-existent controller is worse than none.)*
- **The lawful basis**, stated correctly per purpose. Getting consent-vs-legitimate-interest wrong
  is the single most common enforcement finding.
- **Data-subject rights and the supervisory authority**, with the right complaint route.
- **International transfers** and their safeguards — this is the genuinely technical-legal part:
  Vercel and Resend are US companies even where the regions are EU.
- **Processor relationships** and whether DPAs are in place.

**Recommendation:** feed the inventory in §3 into a reputable generator (Iubenda, Termly) or a
lawyer for a one-off review. At this data profile that is cheap and defensible. The inventory is
the expensive input, and it is already done.

**What I will not do:** write policy prose that you then have to verify. Verifying generated legal
text is as much work as commissioning it, with none of the accountability.

---

## 2. Translation scope — your instinct is right, with one correction

**Proposal on the table:** one English privacy policy + a translated consent line.
**Verdict: broadly correct, and it is not underthinking it — with one thing that must be localized.**

GDPR Art. 12(1) requires information to be "concise, transparent, intelligible and easily
accessible, using clear and plain language." It does not mandate translation into every language.
But if the entire UI addresses someone in Dutch, a notice they can only read in English is weakly
"intelligible" for that person.

The resolution is the **layered approach**, explicitly endorsed in the EDPB/WP29 transparency
guidelines:

| Layer | Language | Cost |
|---|---|---|
| **Point-of-collection notice + consent line** (1–3 sentences, next to the form) | **All six — mandatory** | Low: ~40 words × 6 |
| **Full privacy policy** (linked from that notice and the footer) | **English is defensible now** | Avoids 6 legal translations |

**Why English-only is defensible *here* specifically:** the data collected is an email address and
a country, the purpose is a single launch announcement, and the consent moment itself is fully
localized. The risk is low but **not zero** — I am not claiming it is compliant-by-default.

**When that stops being true:** at product launch, when you collect more than email + country.
Budget the six policy translations then, not now.

**One more localization that is not optional:** the **unsubscribe page and confirmation** should be
localized too. Someone who signed up in Italian and wants out should not hit an English-only wall —
that is a friction that converts into spam complaints, which this domain cannot afford (see the
reputation watch item in `PLAN.md`).

---

## 3. Factual data inventory — the input for the policy

### 3.1 Personal data collected

| Data | Source | Purpose | Where stored |
|---|---|---|---|
| Email address | Signup form | Send the confirmation + launch announcement | Supabase Postgres |
| Country | Signup form (fixed list of 30) | Audience/market understanding | Supabase Postgres |
| `created_at` | Server-generated | Ordering, retention accounting | Supabase Postgres |
| `registration_position` | Server-computed | "You're #N" in the confirmation email | Supabase Postgres |
| Email delivery events (sent/delivered/bounced/complained) | Resend | Deliverability monitoring | Resend |
| **Planned (C3):** salted IP hash + email, short window | Request headers | Abuse/rate limiting | Supabase Postgres |

**Not collected:** no name, no phone, no payment data, no account, **no authentication of any kind**.
**No analytics package.** Resend **open and click tracking are OFF** — confirmed 2026-08-02. Keep off.

### 3.2 Processors and locations

| Processor | Role | Region | Note |
|---|---|---|---|
| **Supabase** | Database + edge function | **North EU (Stockholm)** | Primary store |
| **Vercel** | Hosting | Edge/CDN | US company; request logs may include IPs |
| **Resend** | Transactional email | **eu-west-1**, on AWS SES | US company; EU sending region |
| **unpkg.com** | ⚠ Third-party CDN serving `dotlottie-wc.js` (`layout.jsx:49`) | US | **See 3.5 — avoidable** |

Vercel and Resend are US-headquartered even with EU regions → transfer safeguards are exactly what
the lawyer/template must address.

### 3.3 Lawful basis (to be confirmed by the reviewer)

- **Signup email + launch announcement → consent.** Freely given, specific, informed, unambiguous;
  the submission is the affirmative act. Must be recorded.
- **Rate-limiting data (C3) → legitimate interest**, abuse and fraud prevention, **GDPR Recital 49**.
  Defensible without consent, and must be disclosed in the policy.

### 3.4 Retention (owner decision required — open question 2)

No retention period is currently defined. Proposed default: **hold until launch + 6 months, or
until erasure is requested, whichever is first**, with the throttle table purged per-window.

### 3.5 A third-party flow worth removing rather than disclosing

`app/layout.jsx:49` loads `dotlottie-wc.js` from **unpkg.com**, which discloses every visitor's IP
and user-agent to a third-party CDN — for a decorative animation. That is a data flow you would
otherwise have to declare in the policy.

**Cheapest fix is deletion, not disclosure: self-host the script** (or drop the animation). It also
removes a third-party runtime dependency and a silent failure path already logged under C6. This is
the rare item where the privacy fix and the ponytail fix are the same change.

### 3.6 Also relevant: `localStorage` (arriving with E2)

E2 will persist locale in `localStorage`. That is terminal-equipment storage under the ePrivacy
Directive, but a language preference set by the user's own action is **strictly necessary for a
service they requested** and is generally exempt from consent. **Do not add a cookie banner for
it** — that would be cargo-cult compliance. Just mention it in the policy.

---

## 4. Open questions — owner decisions required before the policy can be written

1. **Who is the controller?** Registered entity name, country of registration, and a contact
   address. If NextCollect is not yet incorporated, the controller is a natural person and the
   policy must say so. **This blocks the policy — a template cannot guess it.**
2. **Retention period** — accept the §3.4 default or set your own?
3. **Erasure route** — is `info@nxtcollect.com` monitored, and is it the address to publish? It is
   currently the only contact anywhere in the product.
4. **Consent mechanism** — explicit tick-box, or submission-as-consent with a clear notice? *(For a
   waitlist where the email IS the service requested, a clear notice above the button is normally
   sufficient and converts better. Tick-box is the more conservative option.)*
5. **DPAs** — are processor agreements accepted with Supabase, Vercel and Resend? Usually a click-through
   in each dashboard.
