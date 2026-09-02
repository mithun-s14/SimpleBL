// Wires the eval harness to the Keenan retrieval + answer pipeline, mirroring
// eval/adapters.ts for the PubMed side. Retrieval and generation are timed
// together so the numbers are comparable with the PubMed cases.

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { askKeenan } from '../src/keenan/ask';
import { retrieve } from '../src/keenan/retrieve';
import type { RagResult } from './types';

// The eval scores retrieval and faithfulness separately, so it needs both the
// candidate set (for precision/recall) and the final answer.
export async function runKeenanQuery(question: string): Promise<RagResult> {
  const chunks = await retrieve(question);
  // Unattended: wait out Groq's rate-limit window rather than failing the run.
  const result = await askKeenan(question, [], { maxRetries: 4 });

  return {
    answer: result.answer,
    // Deduplicated by video: the labels are video-level, so three chunks from
    // one video should not count as three hits.
    retrievedDocs: dedupeByVideo(chunks).map((chunk) => ({
      id: chunk.videoId,
      title: chunk.title,
      text: chunk.text,
    })),
  };
}

function dedupeByVideo<T extends { videoId: string }>(chunks: T[]): T[] {
  const seen = new Set<string>();
  return chunks.filter((c) => (seen.has(c.videoId) ? false : (seen.add(c.videoId), true)));
}
