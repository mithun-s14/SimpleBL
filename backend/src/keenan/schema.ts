// SQLite schema for the Keenan Wiki corpus.
//
// Shared by the ingest script (write path) and the Express routes (read path),
// so there is exactly one definition of the tables. `applySchema` is idempotent
// and safe to call on every open.

import type BetterSqlite3 from 'better-sqlite3';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS videos (
  video_id          TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  published_at      TEXT NOT NULL,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  transcript_status TEXT NOT NULL DEFAULT 'failed',
  ingested_at       TEXT
);

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id              TEXT PRIMARY KEY,
  video_id        TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  text            TEXT NOT NULL,
  start_seconds   INTEGER NOT NULL,
  end_seconds     INTEGER NOT NULL,
  embedding       BLOB NOT NULL,
  embedding_model TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_video ON transcript_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at);

-- Keyword half of hybrid search. External-content table over transcript_chunks,
-- so the text is not duplicated; kept in sync by the triggers below.
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  content='transcript_chunks',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS chunks_fts_ai AFTER INSERT ON transcript_chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_ad AFTER DELETE ON transcript_chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_au AFTER UPDATE ON transcript_chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
`;

export function applySchema(db: BetterSqlite3.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
}

// Float32Array <-> BLOB. Embeddings are stored normalized, so cosine
// similarity at query time is a plain dot product.
export function vectorToBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function blobToVector(blob: Buffer): Float32Array {
  // Copy into a freshly allocated array rather than aliasing the Buffer's
  // pool, which is not guaranteed to be 4-byte aligned.
  const out = new Float32Array(blob.byteLength / 4);
  Buffer.from(out.buffer, out.byteOffset, out.byteLength).set(blob);
  return out;
}
