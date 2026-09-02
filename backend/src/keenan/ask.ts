// Answer generation over retrieved transcript chunks.
//
// The whole value of this feature is that it reflects what one creator actually
// said, so the prompt's hardest constraint is refusing to answer from general
// fitness knowledge when the excerpts do not cover the question.

import { callLLM, parseJsonResponse, sanitizeSourceRefs, type RetryOptions } from '../llm';
import { formatTimestamp, retrieve, youtubeUrl } from './retrieve';
import type { KeenanAnswer, RankedChunk } from './types';

export interface LlmHistoryMessage {
  role: string;
  content: string;
}

const SYSTEM_PROMPT = `You are answering questions about what one specific fitness creator (Keenan) has said in his YouTube videos. You are given numbered excerpts from the transcripts of those videos.

Return ONLY a valid JSON object with no markdown code fences, no preamble, and no explanation. The JSON must exactly match this structure:

{
  "answer": "string (plain prose, 3-6 sentences, with inline bracket numbers like [1] on every claim drawn from the excerpts)",
  "usedSources": [1, 2],
  "sufficientContext": true
}

Rules:
- Answer ONLY from the provided transcript excerpts. This is the most important rule. You are reporting what HE said, not what is true in general.
- If the excerpts do not actually address the question, set "sufficientContext" to false and use "answer" to say plainly that his transcripts in the corpus do not cover it. Do NOT fill the gap with general fitness knowledge, and do NOT stretch a loosely related excerpt into an answer.
- Attribute every claim with a bracket number matching the excerpt it came from.
- "usedSources" must contain EXACTLY the bracket numbers cited in "answer" -- no more, no fewer. Never invent a number that was not provided.
- If excerpts from different dates disagree, say so and prefer the more recent one, mentioning that his view appears to have changed.
- Write plain prose. No markdown headings, bullet lists, bold or links.
- These are automatic captions of casual spoken content, so excerpts may contain filler and tangents. Ignore the filler; do not quote it back.
- Return ONLY the raw JSON object.`;

export function buildContextBlock(chunks: RankedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const date = chunk.publishedAt.slice(0, 10);
      const at = formatTimestamp(chunk.startSeconds);
      return `[${i + 1}] "${chunk.title}" (${date}, ${at})\n${chunk.text}`;
    })
    .join('\n\n');
}

// One or two sentences from the chunk, for the source card. Deliberately short:
// the transcripts are the creator's work and the card should point at the video,
// not substitute for it.
export function buildExcerpt(text: string, maxLength = 220): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const window = trimmed.slice(0, maxLength);
  const lastStop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
  if (lastStop > maxLength * 0.5) return window.slice(0, lastStop + 1);
  return `${window.slice(0, window.lastIndexOf(' '))}...`;
}

export async function askKeenan(
  question: string,
  history: LlmHistoryMessage[] = [],
  // The eval harness runs unattended and can afford to wait out a rate limit;
  // a user request cannot. Defaults come from callLLM.
  retry?: RetryOptions
): Promise<KeenanAnswer> {
  const chunks = await retrieve(question);

  if (chunks.length === 0) {
    return {
      answer:
        "I could not find anything in his transcripts that speaks to that. It may be a topic he has not covered, or the corpus may not go back far enough.",
      sources: [],
      sufficientContext: false,
    };
  }

  const contextBlock = buildContextBlock(chunks);
  const text = await callLLM([
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n=== TRANSCRIPT EXCERPTS ===\n${contextBlock}` },
    // Prior turns give the model referents for follow-ups ("what about for
    // beginners?"). Retrieval still runs on the raw question only -- query
    // rewriting is deliberately left for later.
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ], { retry });

  const result = parseJsonResponse<{
    answer?: unknown;
    usedSources?: unknown;
    sufficientContext?: unknown;
  }>(text);

  const answer = typeof result.answer === 'string' ? result.answer : '';
  const sufficientContext = result.sufficientContext !== false;

  // Never trust the model to transcribe IDs, titles or URLs -- only to say
  // which excerpts it used. Everything else is rebuilt from stored records.
  const used = sanitizeSourceRefs(result.usedSources, chunks.length);

  const sources = used.map((n) => {
    const chunk = chunks[n - 1];
    return {
      videoId: chunk.videoId,
      title: chunk.title,
      publishedAt: chunk.publishedAt.slice(0, 10),
      startSeconds: chunk.startSeconds,
      url: youtubeUrl(chunk.videoId, chunk.startSeconds),
      excerpt: buildExcerpt(chunk.text),
    };
  });

  // The model cites positions in the retrieved list (1..8), but only the cited
  // chunks become sources, renumbered from 1. Without remapping, an answer
  // citing [5] would point at a card labelled [3].
  return {
    answer: renumberCitations(answer, used),
    sources,
    sufficientContext: sufficientContext && sources.length > 0,
  };
}

// `used` maps final source position (index + 1) back to the retrieved position
// it came from. Rewrites every [n] in the answer accordingly, in one pass so
// remapped numbers cannot collide with ones not yet rewritten. A bracket number
// that was not kept as a source is dropped, since it now refers to nothing.
export function renumberCitations(answer: string, used: number[]): string {
  const remap = new Map(used.map((original, index) => [original, index + 1]));

  return answer
    .replace(/\[(\d+)\]/g, (match, digits: string) => {
      const next = remap.get(parseInt(digits, 10));
      return next === undefined ? '' : `[${next}]`;
    })
    // Tidy up spacing left behind by a dropped citation.
    .replace(/ +([.,;:])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}
