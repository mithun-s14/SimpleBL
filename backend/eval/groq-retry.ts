// Shared Groq API fetch wrapper with rate-limit retry logic.
// Groq returns 429 with a "try again in X.Xs" message when TPM limits are hit.

function parseRetryAfterMs(errorBody: string): number {
  const match = errorBody.match(/try again in (\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 1500;
  // Default to 15 seconds if we cannot parse the suggested wait time
  return 15000;
}

// Fetch a Groq endpoint and retry automatically on 429 rate limit responses.
// Returns the Response once it has a non-429 status, or throws after maxRetries.
export async function groqFetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429) return response;

    const body = await response.text();
    const waitMs = parseRetryAfterMs(body);

    if (attempt < maxRetries) {
      console.log(
        `  [eval] Groq rate limit -- waiting ${(waitMs / 1000).toFixed(1)}s` +
          ` (retry ${attempt + 1}/${maxRetries})`
      );
      await new Promise<void>((r) => setTimeout(r, waitMs));
    } else {
      throw new Error(`Groq 429 after ${maxRetries} retries: ${body}`);
    }
  }
  // Unreachable -- TypeScript requires a return/throw after the loop
  throw new Error('groqFetchWithRetry: exhausted retries');
}
