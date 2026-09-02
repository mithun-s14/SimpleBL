// Groq fetch wrapper for the eval harness.
//
// The retry mechanism lives in src/llm.ts so the server and the harness share
// one implementation; this only supplies the eval-specific budget and logging.
// A background eval can afford to wait out a long rate-limit window.

import { groqFetchWithRetry as groqFetch } from '../src/llm';

export async function groqFetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  return groqFetch(url, init, {
    maxRetries,
    onRetry: (waitMs, attempt, total) =>
      console.log(
        `  [eval] Groq rate limit -- waiting ${(waitMs / 1000).toFixed(1)}s` +
          ` (retry ${attempt}/${total})`
      ),
  });
}
