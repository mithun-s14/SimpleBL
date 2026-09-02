// Read path over the Keenan corpus.
//
// The database file is produced offline by `npm run ingest` (see backend/ingest)
// and is read-only here. Opening is lazy and cached: the first request pays for
// it, and a missing file is a normal state (the feature ships dark) rather than
// a crash.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { applySchema, blobToVector } from './schema';
import type { KeenanStats, StoredChunk } from './types';

export const DB_PATH =
  process.env.KEENAN_DB_PATH || path.join(__dirname, '../../data/keenan.db');

let db: Database.Database | null = null;

// Every chunk's embedding, held in memory for brute-force cosine search.
// ~16k chunks x 384 dims is ~24 MB, so this is cheaper than any index.
interface VectorEntry {
  rowid: number;
  vec: Float32Array;
}
let vectors: VectorEntry[] | null = null;

export function corpusExists(): boolean {
  return fs.existsSync(DB_PATH);
}

export function isEnabled(): boolean {
  return process.env.KEENAN_WIKI_ENABLED === 'true' && corpusExists();
}

export function getDb(): Database.Database {
  if (db) return db;
  if (!corpusExists()) {
    throw new Error(`Keenan corpus not found at ${DB_PATH}. Run: npm run ingest`);
  }
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma('foreign_keys = ON');
  return db;
}

// Loaded once and reused. Call resetCorpusCache() if the file is replaced
// underneath a running server.
export function loadVectors(): VectorEntry[] {
  if (vectors) return vectors;
  const rows = getDb()
    .prepare('SELECT rowid, embedding FROM transcript_chunks')
    .all() as Array<{ rowid: number; embedding: Buffer }>;
  vectors = rows.map((r) => ({ rowid: r.rowid, vec: blobToVector(r.embedding) }));
  return vectors;
}

export function resetCorpusCache(): void {
  if (db) db.close();
  db = null;
  vectors = null;
}

const CHUNK_SELECT = `
  SELECT c.rowid          AS rowid,
         c.id             AS id,
         c.video_id       AS videoId,
         c.chunk_index    AS chunkIndex,
         c.text           AS text,
         c.start_seconds  AS startSeconds,
         c.end_seconds    AS endSeconds,
         v.title          AS title,
         v.published_at   AS publishedAt
  FROM transcript_chunks c
  JOIN videos v ON v.video_id = c.video_id
`;

export function getChunksByRowids(rowids: number[]): Map<number, StoredChunk> {
  const out = new Map<number, StoredChunk>();
  if (rowids.length === 0) return out;
  const placeholders = rowids.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`${CHUNK_SELECT} WHERE c.rowid IN (${placeholders})`)
    .all(...rowids) as Array<StoredChunk & { rowid: number }>;
  for (const row of rows) {
    const { rowid, ...chunk } = row;
    out.set(rowid, chunk);
  }
  return out;
}

// Keyword half of hybrid search. FTS5 bm25() returns lower-is-better, so the
// ordering is ascending. The query is passed through FTS5's own syntax, which
// throws on stray punctuation, so callers must sanitize first (see retrieve.ts).
export function keywordSearch(ftsQuery: string, limit: number): number[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT ?`
      )
      .all(ftsQuery, limit) as Array<{ rowid: number }>;
    return rows.map((r) => r.rowid);
  } catch (err) {
    // A malformed MATCH expression should degrade to vector-only retrieval,
    // never take down the request.
    console.error('[keenan] FTS query failed:', (err as Error).message);
    return [];
  }
}

export function getStats(): KeenanStats {
  const d = getDb();
  const videos = d
    .prepare(
      `SELECT COUNT(*) AS count,
              MIN(published_at) AS earliest,
              MAX(published_at) AS latest,
              MAX(ingested_at)  AS lastIngest
       FROM videos WHERE transcript_status = 'ok'`
    )
    .get() as { count: number; earliest: string | null; latest: string | null; lastIngest: string | null };
  const chunks = d.prepare('SELECT COUNT(*) AS count FROM transcript_chunks').get() as {
    count: number;
  };
  const model = d
    .prepare('SELECT embedding_model AS model FROM transcript_chunks LIMIT 1')
    .get() as { model: string } | undefined;

  return {
    videoCount: videos.count,
    chunkCount: chunks.count,
    earliestPublishedAt: videos.earliest,
    latestPublishedAt: videos.latest,
    lastIngestAt: videos.lastIngest,
    embeddingModel: model?.model ?? null,
  };
}
