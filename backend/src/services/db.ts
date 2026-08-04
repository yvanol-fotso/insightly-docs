import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      chunks INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id);
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS indexing_jobs (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | completed_with_errors | failed
      total_chunks INTEGER NOT NULL DEFAULT 0,
      processed_chunks INTEGER NOT NULL DEFAULT 0,
      failed_chunks INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_indexing_jobs_session_id ON indexing_jobs(session_id);
  `);

// add le type de job pour distinguer l'extraction/OCR des jobs graph existants.
  await pool.query(`
    ALTER TABLE indexing_jobs ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'graph';
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_indexing_jobs_job_type ON indexing_jobs(job_type);
  `);

  console.log("Base de données initialisée");
}