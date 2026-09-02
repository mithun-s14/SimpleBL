// Caption normalization.
//
// This matters more than it looks: the keyword half of hybrid search is exact,
// so a mistranscribed "RIR" is simply unfindable. Cleaning runs before chunking
// so both the stored text and the embedded text see the corrected form.

import fs from 'fs';
import path from 'path';
import type { CaptionSegment } from '../src/keenan/types';

interface GlossaryEntry {
  wrong: string;
  right: string;
}

const GLOSSARY_PATH = path.join(__dirname, '../data/keenan_glossary.json');

// [Music], [Applause], [ __ ] and the >> speaker markers carry no meaning and
// pollute both the embedding and the excerpt shown to users.
const ARTIFACT_PATTERN = /\[\s*[^\]]{0,30}\s*\]|>>+/g;

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let compiledGlossary: Array<{ pattern: RegExp; right: string }> | null = null;

export function loadGlossary(glossaryPath = GLOSSARY_PATH): Array<{ pattern: RegExp; right: string }> {
  // Only the default glossary is cached; an explicit path (tests) always reloads.
  const cacheable = glossaryPath === GLOSSARY_PATH;
  if (cacheable && compiledGlossary) return compiledGlossary;

  let entries: GlossaryEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8')) as GlossaryEntry[];
  } catch {
    // An absent or unreadable glossary is not fatal -- cleaning still strips
    // artifacts and normalizes whitespace.
    if (cacheable) compiledGlossary = [];
    return [];
  }

  const compiled = entries
    // Skip no-op pairs; they cost a regex pass and change nothing.
    .filter((e) => e.wrong && e.right && e.wrong.toLowerCase() !== e.right.toLowerCase())
    .map((e) => ({
      // The glossary holds literal strings, not patterns, so escape before
      // compiling. \b is unreliable when a term starts or ends with a
      // non-word character, so guard with lookarounds instead.
      pattern: new RegExp(`(?<![\\w-])${escapeRegex(e.wrong)}(?![\\w-])`, 'gi'),
      right: e.right,
    }));

  if (cacheable) compiledGlossary = compiled;
  return compiled;
}

export function cleanText(text: string, glossary = loadGlossary()): string {
  let out = text.replace(ARTIFACT_PATTERN, ' ');
  for (const { pattern, right } of glossary) {
    out = out.replace(pattern, right);
  }
  return out.replace(/\s+/g, ' ').trim();
}

// Cleans each segment and drops any that became empty (a segment that was only
// "[Music]"), preserving timing on what remains.
export function cleanSegments(segments: CaptionSegment[]): CaptionSegment[] {
  const glossary = loadGlossary();
  return segments
    .map((s) => ({ ...s, text: cleanText(s.text, glossary) }))
    .filter((s) => s.text.length > 0);
}
