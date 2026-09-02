// Write path over the Keenan corpus. The read path lives in src/keenan/store.ts;
// the schema itself is shared from src/keenan/schema.ts so there is one definition.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { applySchema, vectorToBlob } from '../src/keenan/schema';
import type { Chunk, TranscriptStatus, VideoRecord } from '../src/keenan/types';

export function openForWrite(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  applySchema(db);
  return db;
}

export function getKnownVideoIds(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT video_id AS id FROM videos').all() as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

// Videos worth (re)fetching captions for: never attempted, or previously failed
// transiently. `no_captions` is permanent and deliberately excluded.
export function getPendingVideoIds(db: Database.Database): Set<string> {
  const rows = db
    .prepare(`SELECT video_id AS id FROM videos WHERE transcript_status = 'failed'`)
    .all() as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

export function upsertVideo(db: Database.Database, video: Omit<VideoRecord, 'ingestedAt'>): void {
  db.prepare(
    `INSERT INTO videos (video_id, title, published_at, duration_seconds, transcript_status)
     VALUES (@videoId, @title, @publishedAt, @durationSeconds, @transcriptStatus)
     ON CONFLICT(video_id) DO UPDATE SET
       title = excluded.title,
       published_at = excluded.published_at,
       duration_seconds = excluded.duration_seconds`
  ).run(video);
}

export function setTranscriptStatus(
  db: Database.Database,
  videoId: string,
  status: TranscriptStatus
): void {
  db.prepare(
    `UPDATE videos SET transcript_status = ?, ingested_at = ? WHERE video_id = ?`
  ).run(status, new Date().toISOString(), videoId);
}

// Replaces a video's chunks wholesale inside one transaction, so a re-run is a
// clean overwrite rather than an accumulation of duplicates.
export function replaceChunks(
  db: Database.Database,
  videoId: string,
  chunks: Chunk[],
  embeddings: Float32Array[],
  embeddingModel: string
): void {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `chunk/embedding count mismatch for ${videoId}: ${chunks.length} vs ${embeddings.length}`
    );
  }

  const del = db.prepare('DELETE FROM transcript_chunks WHERE video_id = ?');
  const ins = db.prepare(
    `INSERT INTO transcript_chunks
       (id, video_id, chunk_index, text, start_seconds, end_seconds, embedding, embedding_model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    del.run(videoId);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      ins.run(
        crypto.randomUUID(),
        videoId,
        c.chunkIndex,
        c.text,
        c.startSeconds,
        c.endSeconds,
        vectorToBlob(embeddings[i]),
        embeddingModel
      );
    }
  });

  tx();
}

// A model change invalidates every stored vector -- they are not comparable
// across models. Detected here so the run can force a full re-embed.
export function storedEmbeddingModel(db: Database.Database): string | null {
  const row = db
    .prepare('SELECT embedding_model AS model FROM transcript_chunks LIMIT 1')
    .get() as { model: string } | undefined;
  return row?.model ?? null;
}
