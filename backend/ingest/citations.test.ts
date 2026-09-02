// Citation remapping: the model cites positions in the retrieved list, but only
// cited chunks become sources and are renumbered from 1. A mismatch here points
// readers at the wrong video, silently.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renumberCitations } from '../src/keenan/ask';

test('citations are remapped to final source order', () => {
  // Retrieved chunks 2, 5 and 6 were cited; they become sources 1, 2 and 3.
  assert.equal(
    renumberCitations('Alpha [2]. Beta [5] and also [6].', [2, 5, 6]),
    'Alpha [1]. Beta [2] and also [3].'
  );
});

test('repeated and adjacent citations are handled', () => {
  assert.equal(renumberCitations('Claim [5][2] and [5].', [2, 5]), 'Claim [2][1] and [2].');
});

test('a citation with no surviving source is dropped cleanly', () => {
  assert.equal(renumberCitations('Kept [3] and dropped [7].', [3]), 'Kept [1] and dropped.');
});

test('an answer with no citations is unchanged', () => {
  assert.equal(renumberCitations('No citations here.', []), 'No citations here.');
});
