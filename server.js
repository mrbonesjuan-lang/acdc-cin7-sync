// server.js
// Entry point. Starts a tiny web server (so Render/Railway keeps the
// service alive and you can check its status in a browser), and a
// cron-style scheduler that pulls fresh data from Cin7 Omni every
// few minutes into PostgreSQL. Metabase then reads straight from
// that PostgreSQL database — no need for it to know Cin7 exists.

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { Pool } = require('pg');
const { ensureSchema } = require('./db/schema');
const { runSync } = require('./sync');

const { registerDashboardRoutes } = require('./routes/dashboard');
const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed for Render/most managed Postgres
});

const app = express();

app.get('/', (req, res) => {
  res.send('Cin7 sync service is running. See /status for sync history.');
});

app.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM sync_log ORDER BY run_at DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger — handy for testing without waiting for the schedule
app.get('/sync-now', async (req, res) => {
  res.json({ message: 'Sync started — check /status shortly for results' });
  runSync(pool, { lookbackDays: 30 });

});

registerDashboardRoutes(app, pool);

async function start() {
  await ensureSchema(pool);

  // Run once immediately on startup, then on the schedule below
  await runSync(pool, { lookbackDays: 30 });

  // node-cron pattern for "every N minutes"
  cron.schedule(`*/${SYNC_INTERVAL_MINUTES} * * * *`, () => {
    runSync(pool, { lookbackDays: 7 });
  });

  app.listen(PORT, () => {
    console.log(`✓ Cin7 sync service listening on port ${PORT}`);
    console.log(`✓ Syncing every ${SYNC_INTERVAL_MINUTES} minutes`);
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
