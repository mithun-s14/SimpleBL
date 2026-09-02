// Windowing is the one piece of ingestion with real edge cases, and it runs
// offline where a mistake is invisible until retrieval is already tuned.
// Run with: npm run test:ingest

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkSegments } from './chunk';
import { cleanText } from './clean';
import type { CaptionSegment } from '../src/keenan/types';

// Synthetic captions: one 3-second segment every 3 seconds, numbered so the
// text of a window says exactly which segments it covers.
function synthSegments(count: number, step = 3): CaptionSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `seg${i}`,
    start: i * step,
    duration: step,
  }));
}

test('empty input produces no chunks', () => {
  assert.deepEqual(chunkSegments([]), []);
});

test('a single short video is one chunk', () => {
  const chunks = chunkSegments(synthSegments(5));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].startSeconds, 0);
  assert.equal(chunks[0].text, 'seg0 seg1 seg2 seg3 seg4');
});

test('windows are the configured length and stride by window minus overlap', () => {
  const chunks = chunkSegments(synthSegments(100), { windowSeconds: 75, overlapSeconds: 15 });

  assert.ok(chunks.length > 1);
  // Stride is 75 - 15 = 60 seconds.
  assert.equal(chunks[0].startSeconds, 0);
  assert.equal(chunks[1].startSeconds, 60);
  assert.equal(chunks[2].startSeconds, 120);

  // First window holds every segment starting in [0, 75).
  assert.equal(chunks[0].text, synthSegments(25).map((s) => s.text).join(' '));
});

test('consecutive chunks overlap, so a point on a boundary is in both', () => {
  const chunks = chunkSegments(synthSegments(100), { windowSeconds: 75, overlapSeconds: 15 });

  // Segments 20-24 start in [60, 75) and so belong to both chunk 0 and chunk 1.
  for (const seg of ['seg20', 'seg21', 'seg22', 'seg23', 'seg24']) {
    assert.ok(chunks[0].text.includes(seg), `chunk 0 should contain ${seg}`);
    assert.ok(chunks[1].text.includes(seg), `chunk 1 should contain ${seg}`);
  }
});

test('chunk indices are sequential and time ranges are ordered', () => {
  const chunks = chunkSegments(synthSegments(200));

  chunks.forEach((c, i) => {
    assert.equal(c.chunkIndex, i);
    assert.ok(c.endSeconds > c.startSeconds, `chunk ${i} has an inverted range`);
  });

  for (let i = 1; i < chunks.length; i++) {
    assert.ok(
      chunks[i].startSeconds > chunks[i - 1].startSeconds,
      'chunk starts must strictly advance'
    );
  }
});

test('every segment appears in at least one chunk', () => {
  const segments = synthSegments(137);
  const joined = chunkSegments(segments).map((c) => c.text).join(' ');

  for (const seg of segments) {
    assert.ok(joined.includes(seg.text), `${seg.text} was dropped`);
  }
});

test('a short tail is absorbed rather than left as a fragment', () => {
  // 130 seconds of speech: windows at 0 and 60 cover it, and the 120-130
  // remainder is too short to stand alone.
  const chunks = chunkSegments(synthSegments(44), { windowSeconds: 75, overlapSeconds: 15 });
  const tail = chunks[chunks.length - 1];

  assert.ok(tail.endSeconds - tail.startSeconds >= 20, 'tail chunk is a fragment');
  assert.ok(tail.text.includes('seg43'), 'tail content was lost');
});

test('out-of-order segments are sorted before windowing', () => {
  const shuffled = [...synthSegments(30)].reverse();
  const chunks = chunkSegments(shuffled);

  assert.equal(chunks[0].startSeconds, 0);
  assert.ok(chunks[0].text.startsWith('seg0 seg1'));
});

test('a segment longer than the window does not stall the loop', () => {
  const segments: CaptionSegment[] = [
    { text: 'long', start: 0, duration: 200 },
    { text: 'after', start: 200, duration: 3 },
  ];
  const chunks = chunkSegments(segments, { windowSeconds: 75, overlapSeconds: 15 });

  assert.ok(chunks.length >= 1);
  assert.ok(chunks.map((c) => c.text).join(' ').includes('after'));
});

test('overlap must be smaller than the window', () => {
  assert.throws(() => chunkSegments(synthSegments(10), { windowSeconds: 30, overlapSeconds: 30 }));
});

// --- cleaning -------------------------------------------------------------

test('caption artifacts are stripped', () => {
  assert.equal(cleanText('[Music] hello [Applause] world >> again', []), 'hello world again');
});

test('whitespace is collapsed', () => {
  assert.equal(cleanText('a\n\n  b\t\tc', []), 'a b c');
});

test('glossary corrections apply on whole words, case-insensitively', () => {
  const glossary = [{ pattern: /(?<![\w-])our IR(?![\w-])/gi, right: 'RIR' }];
  assert.equal(cleanText('keep two Our IR in the tank', glossary), 'keep two RIR in the tank');
  // Should not fire inside a larger word.
  assert.equal(cleanText('flouring IRritation', glossary), 'flouring IRritation');
});
