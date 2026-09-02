// Caption fetching.
//
// Delegates to ingest/fetch_transcripts.py. The Node transcript clients
// (youtubei.js, youtube-transcript) both return empty bodies now that YouTube
// requires a PO token for `timedtext`; youtube-transcript-api still works.
// The Python side is a pure stdin->stdout leaf: it fetches and prints JSON,
// and every write to the corpus stays here in TypeScript.

import { spawn } from 'child_process';
import path from 'path';
import type { CaptionSegment, TranscriptStatus } from '../src/keenan/types';

export interface TranscriptResult {
  videoId: string;
  status: TranscriptStatus;
  segments: CaptionSegment[];
  error: string | null;
}

const SCRIPT = path.join(__dirname, 'fetch_transcripts.py');

const REPO_ROOT = path.join(__dirname, '../..');

// Point KEENAN_PYTHON at a venv interpreter that has youtube-transcript-api
// installed: pip install -r backend/ingest/requirements.txt
//
// A relative path is resolved against the repo root, not the cwd, so the same
// .env value works whether the script is run from the repo root or backend/.
function pythonBin(): string {
  const configured = process.env.KEENAN_PYTHON;
  if (!configured) return 'python3';
  return configured.startsWith('.') ? path.resolve(REPO_ROOT, configured) : configured;
}

export async function fetchTranscripts(
  videoIds: string[],
  onResult?: (result: TranscriptResult) => void
): Promise<TranscriptResult[]> {
  if (videoIds.length === 0) return [];

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin(), [SCRIPT], { stdio: ['pipe', 'pipe', 'inherit'] });
    const results: TranscriptResult[] = [];
    let buffer = '';

    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', (data: string) => {
      buffer += data;
      // Results stream one JSON object per line, so a long backfill reports
      // progress instead of going silent for an hour.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const result = JSON.parse(line) as TranscriptResult;
        results.push(result);
        onResult?.(result);
      }
    });

    proc.on('error', (err) =>
      reject(
        new Error(
          `Could not run ${pythonBin()}: ${err.message}. ` +
            `Set KEENAN_PYTHON, or see backend/ingest/requirements.txt`
        )
      )
    );

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`fetch_transcripts.py exited with code ${code}`));
        return;
      }
      resolve(results);
    });

    proc.stdin.write(JSON.stringify(videoIds));
    proc.stdin.end();
  });
}
