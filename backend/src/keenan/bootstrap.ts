// Corpus bootstrap.
//
// Ingestion runs in GitHub Actions (YouTube blocks caption requests from cloud
// IPs), so the corpus is published there as a release asset and the server
// fetches it. On a host with a persistent disk, skip this and point
// KEENAN_DB_PATH at the file instead.

import fs from 'fs';
import path from 'path';
import { DB_PATH, corpusExists, resetCorpusCache } from './store';
import { getEmbedder } from './embed';

// e.g. https://github.com/<owner>/<repo>/releases/download/keenan-corpus/keenan.db
const CORPUS_URL = process.env.KEENAN_DB_URL;

// How often to check for a newer corpus. 0 disables re-checking.
const REFRESH_MS = Number(process.env.KEENAN_DB_REFRESH_MS ?? 6 * 60 * 60 * 1000);

let lastModified: string | null = null;

async function download(url: string, destination: string): Promise<boolean> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  // Skip the transfer when the published corpus has not changed since the
  // last fetch.
  const modified = res.headers.get('last-modified');
  if (modified && modified === lastModified) return false;

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  // Write to a temp file and rename, so a failed download cannot leave a
  // truncated database in place of a working one.
  const temp = `${destination}.download`;
  fs.writeFileSync(temp, buffer);
  fs.renameSync(temp, destination);

  lastModified = modified;
  return true;
}

async function refresh(): Promise<void> {
  if (!CORPUS_URL) return;
  try {
    const updated = await download(CORPUS_URL, DB_PATH);
    if (updated) {
      // Drop the cached handle and vectors so the next request reads the new file.
      resetCorpusCache();
      console.log(`[keenan] corpus updated from ${CORPUS_URL}`);
    }
  } catch (err) {
    // A failed refresh must never take the server down; the existing corpus
    // (if any) keeps serving.
    console.error('[keenan] corpus refresh failed:', (err as Error).message);
  }
}

// Called at startup. Deliberately not awaited by the listen call: a slow or
// failing download should not delay the rest of the API coming up.
export async function bootstrapKeenan(): Promise<void> {
  if (process.env.KEENAN_WIKI_ENABLED !== 'true') return;

  if (CORPUS_URL) {
    await refresh();
    if (REFRESH_MS > 0) {
      // unref() so this timer cannot hold the process open on shutdown.
      setInterval(refresh, REFRESH_MS).unref();
    }
  }

  if (!corpusExists()) {
    console.warn(
      `[keenan] enabled but no corpus at ${DB_PATH}. ` +
        'Run `npm run ingest`, or set KEENAN_DB_URL. /api/keenan/* will return 503.'
    );
    return;
  }

  // First load pulls ~25 MB of model weights and takes a few seconds; do it now
  // rather than inside the first user request.
  try {
    await getEmbedder();
    console.log('[keenan] corpus ready, embedding model warm');
  } catch (err) {
    console.error('[keenan] could not load the embedding model:', (err as Error).message);
  }
}
