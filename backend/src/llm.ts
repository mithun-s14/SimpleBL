// Shared Groq client.
//
// Extracted from index.ts so /api/search, /api/study/chat and /api/keenan/ask
// all go through one place: one model name, one auth header, one set of error
// semantics. The JSON helpers below encode hardening learned from gpt-oss-120b,
// which will wrap JSON in code fences and emit raw newlines inside strings.

export const ANSWER_MODEL = process.env.KEENAN_ANSWER_MODEL || 'openai/gpt-oss-120b';

export interface RetryOptions {
  maxRetries?: number;
  // Cap the total time spent sleeping. A background eval can afford to wait
  // out a long rate-limit window; a user sitting on a request cannot.
  maxWaitMs?: number;
  onRetry?: (waitMs: number, attempt: number, maxRetries: number) => void;
}

function parseRetryAfterMs(errorBody: string): number {
  const match = errorBody.match(/try again in (\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 1500;
  return 15000; // Groq did not say; assume the usual TPM window
}

// Groq returns 429 with a "try again in X.Xs" message when TPM limits are hit,
// which the free tier does routinely on prompts this size.
export async function groqFetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 2;
  const maxWaitMs = options.maxWaitMs ?? Infinity;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429) return response;

    const body = await response.text();
    const waitMs = parseRetryAfterMs(body);

    if (attempt >= maxRetries || waitMs > maxWaitMs) {
      throw new Error(`Groq 429 after ${attempt} retr${attempt === 1 ? 'y' : 'ies'}: ${body}`);
    }

    options.onRetry?.(waitMs, attempt + 1, maxRetries);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error('groqFetchWithRetry: exhausted retries');
}

export interface LlmMessage {
  role: string;
  content: string;
}

interface GroqChatResponse {
  choices: Array<{ message: { content: string } }>;
}

export interface CallOptions {
  model?: string;
  // Defaults suit a user-facing request: retry once, briefly. Background work
  // (the eval harness) should pass a more patient budget.
  retry?: RetryOptions;
}

export async function callLLM(messages: LlmMessage[], options: CallOptions = {}): Promise<string> {
  const model = options.model ?? ANSWER_MODEL;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const response = await groqFetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
    },
    // A user is waiting on this, so retry once for a short window only.
    options.retry ?? { maxRetries: 1, maxWaitMs: 12_000 }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq ${response.status}: ${text}`);
  }

  const data = (await response.json()) as GroqChatResponse;
  return data.choices[0].message.content;
}

// Strips the markdown fences the model adds despite being told not to, then
// escapes literal control characters that appear inside JSON string values
// (a raw newline inside a quoted string is not valid JSON).
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const sanitized = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  );

  return JSON.parse(sanitized) as T;
}

// The model is only ever trusted to say *which* sources it used -- never to
// transcribe an ID, title or URL. Returns 1-based indices, deduplicated and
// clamped to what was actually retrieved.
export function sanitizeSourceRefs(refs: unknown, available: number): number[] {
  if (!Array.isArray(refs)) return [];
  const seen = new Set<number>();
  return refs.filter(
    (n): n is number =>
      Number.isInteger(n) && n >= 1 && n <= available && !seen.has(n) && (seen.add(n), true)
  );
}
