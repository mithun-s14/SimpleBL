// Windowing caption segments into retrievable chunks.
//
// Raw caption segments are 2-5 seconds long and carry no standalone meaning, so
// they are merged into overlapping time windows. This is the one piece of the
// pipeline with real edge cases, so it is kept pure and side-effect free --
// see ingest/chunk.test.ts.

import type { CaptionSegment, Chunk } from '../src/keenan/types';

export const WINDOW_SECONDS = 75;
export const OVERLAP_SECONDS = 15;

// If less than this much speech would be left over after a window, it is
// absorbed into that window instead of becoming a fragment with no context.
const MIN_TAIL_SECONDS = 20;

export interface ChunkOptions {
  windowSeconds?: number;
  overlapSeconds?: number;
}

export function chunkSegments(
  segments: CaptionSegment[],
  options: ChunkOptions = {}
): Chunk[] {
  const windowSeconds = options.windowSeconds ?? WINDOW_SECONDS;
  const overlapSeconds = options.overlapSeconds ?? OVERLAP_SECONDS;

  if (overlapSeconds >= windowSeconds) {
    throw new Error(`overlapSeconds (${overlapSeconds}) must be < windowSeconds (${windowSeconds})`);
  }
  if (segments.length === 0) return [];

  // Defensive: callers get segments straight off the wire, and out-of-order
  // input would silently produce chunks with inverted time ranges.
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const stride = windowSeconds - overlapSeconds;

  const chunks: Chunk[] = [];
  let cursor = 0; // index of the first segment not yet closed off

  while (cursor < sorted.length) {
    const windowStart = sorted[cursor].start;
    const windowEnd = windowStart + windowSeconds;

    // Take every segment that begins inside this window. Always take at least
    // one, so a segment longer than the window cannot stall the loop.
    let end = cursor;
    while (end < sorted.length && sorted[end].start < windowEnd) end++;
    if (end === cursor) end = cursor + 1;

    // If only a sliver of the video would remain after this window, absorb it
    // now. Doing it here rather than merging chunks afterwards keeps every
    // segment's text in exactly one place.
    const finalSegment = sorted[sorted.length - 1];
    const videoEnd = finalSegment.start + finalSegment.duration;
    if (end < sorted.length && videoEnd - sorted[end].start < MIN_TAIL_SECONDS) {
      end = sorted.length;
    }

    const window = sorted.slice(cursor, end);
    const last = window[window.length - 1];

    chunks.push({
      chunkIndex: chunks.length,
      text: window.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(),
      startSeconds: Math.floor(windowStart),
      endSeconds: Math.ceil(last.start + last.duration),
    });

    if (end >= sorted.length) break;

    // Advance by the stride, not by the window, so consecutive chunks overlap.
    const nextStart = windowStart + stride;
    let next = cursor;
    while (next < sorted.length && sorted[next].start < nextStart) next++;
    // Guarantee forward progress even if a stride lands inside one long segment.
    cursor = Math.max(next, cursor + 1);
  }

  return chunks;
}
