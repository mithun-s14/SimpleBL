// Keenan Wiki ingestion.
//
//   npm run ingest                 incremental: only videos not already stored
//   npm run ingest -- --full       re-walk the whole channel
//   npm run ingest -- --limit 5    stop after N videos (use this first)
//   npm run ingest -- --reembed    rebuild every vector (after a model change)
//
// Idempotent: a run with nothing new is a no-op. Must NOT run on the production
// web server -- YouTube IP-blocks caption requests from cloud ranges. See
// .github/workflows/keenan-ingest.yml.

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { chunkSegments } from './chunk';
import { cleanSegments } from './clean';
import {
  getKnownVideoIds,
  getPendingVideoIds,
  openForWrite,
  replaceChunks,
  setTranscriptStatus,
  storedEmbeddingModel,
  upsertVideo,
} from './db';
import { fetchTranscripts } from './transcripts';
import { discoverVideos, type DiscoveredVideo } from './youtube';
import { discoverVideosFallback, resolveChannelId } from './youtube-fallback';
import { EMBEDDING_MODEL, buildEmbeddingText, embed } from '../src/keenan/embed';
import { DB_PATH } from '../src/keenan/store';

interface Args {
  full: boolean;
  limit: number | null;
  reembed: boolean;
}

function parseArgs(argv: string[]): Args {
  const limitIndex = argv.indexOf('--limit');
  return {
    full: argv.includes('--full'),
    reembed: argv.includes('--reembed'),
    limit: limitIndex >= 0 ? parseInt(argv[limitIndex + 1], 10) : null,
  };
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();

  const channelRef = process.env.KEENAN_CHANNEL_ID;
  if (!channelRef) {
    throw new Error('KEENAN_CHANNEL_ID is not set (a UC... ID or an @handle)');
  }

  const db = openForWrite(DB_PATH);
  console.log(`corpus: ${DB_PATH}`);

  // Vectors from a different model are not comparable with new ones, so a
  // model change forces a full re-embed rather than silently mixing spaces.
  const previousModel = storedEmbeddingModel(db);
  const modelChanged = previousModel !== null && previousModel !== EMBEDDING_MODEL;
  if (modelChanged) {
    console.log(`embedding model changed: ${previousModel} -> ${EMBEDDING_MODEL}; re-embedding all`);
  }
  const reembedAll = args.reembed || modelChanged;

  // --- discover -----------------------------------------------------------
  const known = getKnownVideoIds(db);
  const incremental = !args.full && !reembedAll && known.size > 0;

  const useDataApi = Boolean(process.env.YOUTUBE_API_KEY);
  if (!useDataApi) {
    console.log('YOUTUBE_API_KEY not set - using the youtubei.js fallback for discovery');
  }

  const channelId = useDataApi ? channelRef : await resolveChannelId(channelRef);

  console.log(`discovering videos (${incremental ? 'incremental' : 'full'})...`);
  const discover = useDataApi ? discoverVideos : discoverVideosFallback;
  const discovered: DiscoveredVideo[] = await discover(
    channelId,
    incremental ? known : null,
    (count) => process.stdout.write(`\r  found ${count}`)
  );
  process.stdout.write('\n');

  for (const video of discovered) {
    upsertVideo(db, video);
  }
  console.log(`  ${discovered.length} new video(s) recorded`);

  // --- decide what needs captions ----------------------------------------
  // New videos, plus earlier transient failures. `no_captions` is permanent.
  const pending = new Set<string>([...discovered.map((v) => v.videoId), ...getPendingVideoIds(db)]);
  let targets = [...pending];

  if (reembedAll) {
    const all = db
      .prepare(`SELECT video_id AS id FROM videos WHERE transcript_status = 'ok'`)
      .all() as Array<{ id: string }>;
    targets = [...new Set([...targets, ...all.map((r) => r.id)])];
  }

  if (args.limit !== null && !Number.isNaN(args.limit)) {
    targets = targets.slice(0, args.limit);
  }

  if (targets.length === 0) {
    console.log('nothing to do - corpus is up to date');
    db.close();
    return;
  }

  console.log(`fetching transcripts for ${targets.length} video(s)...`);

  // --- fetch, clean, chunk, embed, store ---------------------------------
  const videoMeta = new Map(
    (
      db
        .prepare('SELECT video_id AS id, title, published_at AS publishedAt FROM videos')
        .all() as Array<{ id: string; title: string; publishedAt: string }>
    ).map((r) => [r.id, r])
  );

  const counts = { ok: 0, no_captions: 0, failed: 0 };
  let totalChunks = 0;

  const results = await fetchTranscripts(targets);

  for (const result of results) {
    counts[result.status]++;

    if (result.status !== 'ok' || result.segments.length === 0) {
      const status = result.status === 'ok' ? 'no_captions' : result.status;
      setTranscriptStatus(db, result.videoId, status);
      console.log(`  ${result.videoId} ${status}${result.error ? ` (${result.error})` : ''}`);
      continue;
    }

    const meta = videoMeta.get(result.videoId);
    const cleaned = cleanSegments(result.segments);
    const chunks = chunkSegments(cleaned);

    if (chunks.length === 0) {
      setTranscriptStatus(db, result.videoId, 'no_captions');
      continue;
    }

    // The embedded text carries the video title and month so the vector holds
    // video context; the bare chunk text is what gets stored and shown.
    const embeddings = await embed(
      chunks.map((c) =>
        buildEmbeddingText(meta?.title ?? '', meta?.publishedAt ?? '', c.text)
      )
    );

    replaceChunks(db, result.videoId, chunks, embeddings, EMBEDDING_MODEL);
    setTranscriptStatus(db, result.videoId, 'ok');
    totalChunks += chunks.length;

    console.log(
      `  ${result.videoId} ok - ${result.segments.length} segments -> ${chunks.length} chunks - ${meta?.title ?? ''}`
    );
  }

  db.close();

  console.log(
    `\ndone in ${formatDuration(Date.now() - started)}: ` +
      `${counts.ok} ok, ${counts.no_captions} without captions, ${counts.failed} failed ` +
      `(retried next run), ${totalChunks} chunks embedded`
  );
}

main().catch((err) => {
  console.error('[ingest]', err instanceof Error ? err.message : err);
  process.exit(1);
});
