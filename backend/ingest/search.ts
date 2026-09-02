// Retrieval inspector. Prints ranked chunks with their fusion scores and deep
// links, with no LLM in the loop -- the place to tune windowing, RRF and the
// dedup threshold before answer quality is confounded by the model.
//
//   npm run search -- "how much protein per day"
//   npm run search -- --top 15 "is junk volume real"

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { formatTimestamp, retrieve, toFtsQuery, youtubeUrl } from '../src/keenan/retrieve';
import { corpusExists, getStats } from '../src/keenan/store';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const topIndex = argv.indexOf('--top');
  const topK = topIndex >= 0 ? parseInt(argv[topIndex + 1], 10) : undefined;
  const question = argv
    .filter((_, i) => topIndex < 0 || (i !== topIndex && i !== topIndex + 1))
    .join(' ')
    .trim();

  if (!question) {
    console.error('usage: npm run search -- [--top N] "your question"');
    process.exit(1);
  }
  if (!corpusExists()) {
    console.error('No corpus yet. Run: npm run ingest');
    process.exit(1);
  }

  const stats = getStats();
  console.log(`corpus: ${stats.videoCount} videos, ${stats.chunkCount} chunks`);
  console.log(`question: ${question}`);
  console.log(`fts query: ${toFtsQuery(question)}\n`);

  const started = Date.now();
  const results = await retrieve(question, { topK });
  const elapsed = Date.now() - started;

  if (results.length === 0) {
    console.log('no results');
    return;
  }

  results.forEach((chunk, i) => {
    const vec = chunk.vectorRank === null ? '-' : `#${chunk.vectorRank}`;
    const kw = chunk.keywordRank === null ? '-' : `#${chunk.keywordRank}`;
    console.log(
      `[${i + 1}] rrf=${chunk.score.toFixed(5)}  vector=${vec}  keyword=${kw}\n` +
        `    ${chunk.title}\n` +
        `    ${chunk.publishedAt.slice(0, 10)} @ ${formatTimestamp(chunk.startSeconds)}  ` +
        `${youtubeUrl(chunk.videoId, chunk.startSeconds)}\n` +
        `    ${chunk.text.slice(0, 220).replace(/\s+/g, ' ')}...\n`
    );
  });

  console.log(`${results.length} result(s) in ${elapsed}ms (first call includes model load)`);
}

main().catch((err) => {
  console.error('[search]', err instanceof Error ? err.message : err);
  process.exit(1);
});
