// Print WHICH Supabase project each DB env var points at — host, port, and project
// ref only, never the password. Use it to confirm an environment is wired to the
// right org during the prod/dev account split.
//
//   tsx scripts/db-target.ts                                  # local .env (DEV / free org)
//   dotenv -e .env.prod.local -- tsx scripts/db-target.ts     # prod creds (PROD / Pro org)
//
// or via pnpm:  pnpm db:target   /   pnpm db:target:prod
import 'dotenv/config';

function projectRef(u: URL): string {
  // Pooler URLs: user = "postgres.<ref>". Direct URLs: host = "db.<ref>.supabase.co".
  if (u.username.includes('.')) return u.username.split('.')[1] || '(unknown)';
  const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  return m ? m[1] : '(unknown)';
}

function describe(name: string, raw: string | undefined): void {
  if (!raw) {
    console.log(`${name.padEnd(13)} (not set)`);
    return;
  }
  try {
    const u = new URL(raw);
    const pooler = u.port === '6543' ? 'transaction pooler' : u.port === '5432' ? 'session pooler/direct' : '';
    console.log(`${name.padEnd(13)} projectRef=${projectRef(u)}  host=${u.hostname}:${u.port} ${pooler ? `(${pooler})` : ''}`);
  } catch {
    console.log(`${name.padEnd(13)} (unparseable URL)`);
  }
}

console.log('Supabase target for the loaded environment (password never printed):');
describe('DATABASE_URL', process.env.DATABASE_URL);
describe('DIRECT_URL', process.env.DIRECT_URL);
console.log('\nTip: the projectRef should differ between your DEV (free) and PROD (Pro) orgs.');
