// Hybrid retrieval over the transcript corpus.
//
// Vector-only search underperforms here because exact terminology carries the
// meaning ("RIR", "lengthened partials", "junk volume") and embeddings blur
// those together. So: dense and keyword lists, fused by reciprocal rank.
//
// This is the part most likely to need tuning, which is why it is a plain
// function with no Express or LLM in it -- see eval/run-keenan.ts.

import { dot, embedOne } from './embed';
import { getChunksByRowids, keywordSearch, loadVectors } from './store';
import type { RankedChunk } from './types';

export const CANDIDATES_PER_LIST = 20;
export const TOP_K = 8; // matches the PubMed pipeline's TOP_K
export const MAX_PER_VIDEO = 3;
export const DUPLICATE_THRESHOLD = 0.95;
const RRF_K = 60;

export interface RetrieveOptions {
  topK?: number;
  maxPerVideo?: number;
  duplicateThreshold?: number;
}

// FTS5 parses its own query syntax and throws on stray punctuation, so the
// question is reduced to quoted terms OR'd together. Quoting also stops words
// like "AND" or "NOT" in a natural question being read as operators.
export function toFtsQuery(question: string): string {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const unique = [...new Set(terms)].slice(0, 24);
  return unique.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our',
  'out', 'his', 'has', 'had', 'how', 'its', 'who', 'did', 'yes', 'why', 'what', 'when', 'does',
  'with', 'this', 'that', 'from', 'they', 'have', 'been', 'were', 'will', 'your', 'about',
  'there', 'their', 'would', 'could', 'should', 'which', 'these', 'those', 'than', 'then',
]);

// score(d) = sum over lists of 1 / (k + rank(d)). Rank-based, so the two lists'
// incomparable score scales (cosine vs bm25) never have to be reconciled.
function reciprocalRankFusion(
  lists: number[][]
): Map<number, { score: number; ranks: Array<number | null> }> {
  const fused = new Map<number, { score: number; ranks: Array<number | null> }>();

  lists.forEach((list, listIndex) => {
    list.forEach((rowid, index) => {
      const rank = index + 1;
      let entry = fused.get(rowid);
      if (!entry) {
        entry = { score: 0, ranks: lists.map(() => null) };
        fused.set(rowid, entry);
      }
      entry.score += 1 / (RRF_K + rank);
      entry.ranks[listIndex] = rank;
    });
  });

  return fused;
}

export async function retrieve(
  question: string,
  options: RetrieveOptions = {}
): Promise<RankedChunk[]> {
  const topK = options.topK ?? TOP_K;
  const maxPerVideo = options.maxPerVideo ?? MAX_PER_VIDEO;
  const duplicateThreshold = options.duplicateThreshold ?? DUPLICATE_THRESHOLD;

  const queryVec = await embedOne(question);
  const vectors = loadVectors();

  // Brute-force cosine. At ~16k chunks this is a few milliseconds, so an index
  // would be complexity with nothing to buy.
  const dense = vectors
    .map((entry) => ({ rowid: entry.rowid, sim: dot(queryVec, entry.vec) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, CANDIDATES_PER_LIST);

  const keyword = keywordSearch(toFtsQuery(question), CANDIDATES_PER_LIST);

  const fused = reciprocalRankFusion([dense.map((d) => d.rowid), keyword]);
  const ordered = [...fused.entries()].sort((a, b) => b[1].score - a[1].score);

  const chunks = getChunksByRowids(ordered.map(([rowid]) => rowid));
  const vectorByRowid = new Map(vectors.map((v) => [v.rowid, v.vec]));

  const selected: RankedChunk[] = [];
  const selectedVectors: Float32Array[] = [];
  const perVideo = new Map<string, number>();

  for (const [rowid, { score, ranks }] of ordered) {
    if (selected.length >= topK) break;

    const chunk = chunks.get(rowid);
    if (!chunk) continue;

    // He repeats the same advice across hundreds of videos. Without this the
    // context window fills with near-identical text and the answer narrows.
    const vec = vectorByRowid.get(rowid);
    if (vec && selectedVectors.some((other) => dot(vec, other) > duplicateThreshold)) {
      continue;
    }

    // Cap per video so an answer draws on several sources rather than one.
    const count = perVideo.get(chunk.videoId) ?? 0;
    if (count >= maxPerVideo) continue;
    perVideo.set(chunk.videoId, count + 1);

    selected.push({ ...chunk, score, vectorRank: ranks[0], keywordRank: ranks[1] });
    if (vec) selectedVectors.push(vec);
  }

  return selected;
}

export function youtubeUrl(videoId: string, startSeconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.floor(startSeconds))}s`;
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
