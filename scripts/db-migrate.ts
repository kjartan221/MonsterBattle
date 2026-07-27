/**
 * DB migration: creates all required MongoDB indexes on the cloud cluster.
 * NOT run on the request path and NOT a deploy step — indexes persist on the
 * shared cloud DB once created. Run it manually (dev/ops) against a cluster
 * only when indexes change: a fresh DB, or after editing ensureSchema().
 * The app fail-fasts on boot if a required unique index is missing.
 *
 * Usage: npm run db:migrate   (needs MONGODB_URI in env / .env.local)
 */
import { config } from 'dotenv';
config({ path: '.env.local' }); // Next auto-loads this for the app; a bare script does not

import { connectRaw, ensureSchema } from '../src/lib/mongodb';

async function main() {
  const { db } = await connectRaw();
  await ensureSchema(db);
  console.log('db-migrate: indexes ensured');
  process.exit(0);
}

main().catch((e) => {
  console.error('db-migrate failed:', e);
  process.exit(1);
});
