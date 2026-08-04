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
 *
 * WHY IT LOADS ENV VIA @next/env
 * This runs as a bare node process, and node does NOT read .env files — only Next does,
 * during `next build`. Without this, the guard failed locally even with a perfectly correct
 * .env, while passing on Vercel (where vars come from the real environment). A check that
 * cries wolf locally is worse than no check: it trains people to bypass it.
 *
 * @next/env is Next's own loader, already installed as a Next dependency. Using it means the
 * guard sees exactly what the build will see — same files, same precedence
 * (.env.local > .env), and process.env still wins, so Vercel behaviour is unchanged.
 */

// @next/env is CommonJS, so it must be imported as a default and destructured —
// `import { loadEnvConfig }` throws under ESM.
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;

// Matches `next build`: reads .env* from the project root, without overriding anything
// already present in process.env.
loadEnvConfig(process.cwd(), /* dev */ false, { info: () => {}, error: () => {} });

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
