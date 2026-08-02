/**
 * Build-time environment guard.
 *
 * WHY THIS EXISTS
 * Production pointed at a DELETED Supabase project for roughly five months and nobody
 * noticed, because a client-side DNS failure cannot report itself through the very host
 * it failed to reach. In-app telemetry is structurally blind to this failure class — the
 * beacon would go to the same dead host. The only thing that catches it is a check that
 * runs BEFORE the bundle is built. See docs/DECISIONS.md → D-012.
 *
 * WHY IT PINS AN EXPECTED REF RATHER THAN JUST CHECKING CONSISTENCY
 * The outage had the URL *and* the anon key both pointing at the same wrong project, so
 * a URL-vs-key consistency check alone would have passed. Only pinning the expected
 * project catches "consistently wrong".
 *
 * The project ref is NOT a secret — it is the public URL subdomain and ships in every
 * browser bundle. Committing it is fine.
 *
 * Runs via the `prebuild` npm hook, so it gates `npm run build` locally and on Vercel.
 * No network calls: hermetic and fast.
 */

const EXPECTED_REF = 'nofzyhxjpsikdhbcpfuo';

const fail = (msg) => {
  console.error(`\n✗ Environment check failed\n  ${msg}\n`);
  process.exit(1);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not set.');
if (!key) fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');

let urlRef;
try {
  urlRef = new URL(url).hostname.split('.')[0];
} catch {
  fail(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL.`);
}

if (urlRef !== EXPECTED_REF) {
  fail(
    `NEXT_PUBLIC_SUPABASE_URL points at project "${urlRef}", expected "${EXPECTED_REF}".\n` +
    `  This is the exact failure that took production down for five months (D-012).`,
  );
}

// Supabase anon keys are JWTs carrying a `ref` claim. Newer publishable keys
// (sb_publishable_...) are not, so treat a non-JWT as "cannot check" rather than a failure.
const parts = key.split('.');
if (parts.length === 3) {
  let keyRef;
  try {
    keyRef = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).ref;
  } catch {
    fail('NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a JWT but its payload could not be read.');
  }
  if (keyRef && keyRef !== EXPECTED_REF) {
    fail(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to project "${keyRef}", expected "${EXPECTED_REF}".\n` +
      `  The URL and the key must belong to the same project.`,
    );
  }
} else {
  console.warn('  note: anon key is not a JWT, so its project ref could not be cross-checked.');
}

console.log(`✓ Environment check passed — Supabase project "${EXPECTED_REF}".`);
