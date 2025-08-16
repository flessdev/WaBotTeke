// eventsStore.js
import { Pool } from 'pg';

// Usa la misma URL de conexión que ya tienes en tu entorno
const pool = new Pool({
  connectionString: process.env.PG_DATABASE_URL,
  ssl: true
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS bot_events (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL
  )
`);

export async function saveEvents(id, text) {
  await pool.query(
    `INSERT INTO bot_events (id, content)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content`,
    [id, text]
  );
}

export async function getEvents(id) {
  const { rows } = await pool.query(
    `SELECT content FROM bot_events WHERE id = $1`,
    [id]
  );
  return rows.length ? rows[0].content : null;
}
