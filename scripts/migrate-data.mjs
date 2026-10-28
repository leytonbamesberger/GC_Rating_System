#!/usr/bin/env node
// One-off copy of the GC Rating System data from the old Supabase project into the gc_ tables of the
// shared Legacy project (see supabase/gc_schema.sql, which must already be applied there).
//
//   old project                new project
//   project_managers     ->    gc_project_managers
//   general_contractors  ->    gc_contractors
//   ratings              ->    gc_ratings
//   bid_thresholds       ->    gc_bid_thresholds   (single row; overwrites the seeded defaults)
//
// Tables are copied in FK order. id and created_at are preserved. azure_oid and email are not part of
// the copy, so they stay null on new rows (and are left alone on rows that already exist, so claimed
// PM rows survive a re-run). Writes are upserts keyed on id, so the script is safe to run again.
//
// Credentials come from project/.env.migrate (gitignored), one KEY=value per line:
//   OLD_SUPABASE_URL=https://<old-ref>.supabase.co
//   OLD_SUPABASE_KEY=<anon or service-role key; the old tables allow anon reads>
//   NEW_SUPABASE_URL=https://<shared-ref>.supabase.co
//   NEW_SUPABASE_SERVICE_ROLE_KEY=<service-role key; needed to write past RLS>
//
// Run from project/:  node scripts/migrate-data.mjs
// Exits 1 if any copy fails or any table's row counts differ afterwards.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.migrate');
const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request by default
const BATCH_SIZE = 500;

const RATING_SCORES = [
  'payment_timeline',
  'co_approval_timeline',
  'co_negotiations',
  'contract_terms',
  'conflict_mitigation',
  'schedule_trade_stacking',
  'schedule_accuracy',
  'site_control',
  'relationship',
];

// Parents before children: gc_ratings references both other tables.
const TABLES = [
  { from: 'project_managers', to: 'gc_project_managers', columns: ['id', 'name', 'created_at'] },
  {
    from: 'general_contractors',
    to: 'gc_contractors',
    columns: [
      'id',
      'name',
      'aliases',
      'project_award_probability',
      'award_probability',
      'hit_rate_dollar',
      'est_relationship',
      'total_bids',
      'total_bids_submitted_raw',
      'created_at',
    ],
  },
  {
    from: 'ratings',
    to: 'gc_ratings',
    columns: ['id', 'gc_id', 'pm_id', 'job_number', 'job_name', ...RATING_SCORES, 'safety', 'created_at'],
  },
  {
    from: 'bid_thresholds',
    to: 'gc_bid_thresholds',
    columns: ['id', 'tier_2_min', 'tier_3_min', 'tier_4_min', 'tier_5_min', 'updated_at'],
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Could not read ${path}. Create it with OLD_SUPABASE_URL, OLD_SUPABASE_KEY, NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY.`);
  }
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const env = loadEnv(ENV_PATH);
const missing = ['OLD_SUPABASE_URL', 'OLD_SUPABASE_KEY', 'NEW_SUPABASE_URL', 'NEW_SUPABASE_SERVICE_ROLE_KEY'].filter(
  (name) => !env[name],
);
if (missing.length) fail(`Missing in ${ENV_PATH}: ${missing.join(', ')}`);

const { createClient } = await import('@supabase/supabase-js');
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(env.OLD_SUPABASE_URL, env.OLD_SUPABASE_KEY, clientOptions);
const newDb = createClient(env.NEW_SUPABASE_URL, env.NEW_SUPABASE_SERVICE_ROLE_KEY, clientOptions);

function describe(error) {
  return [error.message, error.details, error.hint].filter(Boolean).join(' | ');
}

async function fetchAll(table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    // Ordering by id keeps the pages stable while we walk them.
    const { data, error } = await oldDb
      .from(table)
      .select('*')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`read ${table}: ${describe(error)}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Keep only the columns the new table knows about. A column missing from the old table (an old
// migration never applied) is left out and takes the new table's default.
function pick(row, columns) {
  const out = {};
  for (const column of columns) {
    if (row[column] !== undefined) out[column] = row[column];
  }
  return out;
}

async function copyTable({ from, to, columns }) {
  const rows = (await fetchAll(from)).map((row) => pick(row, columns));
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await newDb.from(to).upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: 'id' });
    if (error) throw new Error(`write ${to} (rows ${i + 1}-${i + Math.min(BATCH_SIZE, rows.length - i)}): ${describe(error)}`);
  }
  return rows.length;
}

async function countRows(db, table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`count ${table}: ${describe(error)}`);
  return count;
}

let failed = false;

for (const table of TABLES) {
  try {
    const copied = await copyTable(table);
    console.log(`${table.from} -> ${table.to}: copied ${copied} rows`);
  } catch (err) {
    failed = true;
    console.error(`${table.from} -> ${table.to}: FAILED, ${err.message}`);
    // Later tables depend on this one through foreign keys, so stop here.
    break;
  }
}

console.log('\nRow counts');
const pad = (value, width) => String(value).padEnd(width);
console.log(`${pad('table', 22)}${pad('old', 8)}${pad('new', 8)}status`);

let mismatched = false;
for (const table of TABLES) {
  try {
    const oldCount = await countRows(oldDb, table.from);
    const newCount = await countRows(newDb, table.to);
    let status = 'OK';
    if (newCount < oldCount) status = `MISMATCH (${oldCount - newCount} missing in new)`;
    else if (newCount > oldCount) status = `MISMATCH (${newCount - oldCount} extra in new; added there since, or the old side changed)`;
    if (status !== 'OK') mismatched = true;
    console.log(`${pad(table.from, 22)}${pad(oldCount, 8)}${pad(newCount, 8)}${status}`);
  } catch (err) {
    failed = true;
    console.error(`${pad(table.from, 22)}count failed: ${err.message}`);
  }
}

if (failed || mismatched) {
  console.error(`\n${failed ? 'Errors occurred. ' : ''}${mismatched ? 'Row counts do not match.' : ''}`.trimEnd());
  process.exit(1);
}
console.log('\nAll tables match.');
