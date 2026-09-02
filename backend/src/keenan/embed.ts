// Local sentence embeddings.
//
// Groq has no embeddings endpoint, so rather than adding a second paid provider
// this runs all-MiniLM-L6-v2 (384 dims) in-process via ONNX. No API key, no
// network at query time. Shared by the ingest script and the ask route so both
// sides embed identically -- a mismatch here silently destroys retrieval.

import { pipeline } from '@huggingface/transformers';

export const EMBEDDING_MODEL = process.env.KEENAN_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMS = 384;

type Embedder = (
  texts: string[],
  opts: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

let embedderPromise: Promise<Embedder> | null = null;

// First call downloads ~25 MB of weights and takes a few seconds. Warm this at
// boot rather than paying for it inside a user request.
export function getEmbedder(): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', EMBEDDING_MODEL) as unknown as Promise<Embedder>;
  }
  return embedderPromise;
}

// Embeddings are L2-normalized at creation, so cosine similarity downstream is
// a plain dot product.
export async function embed(texts: string[], batchSize = 100): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const embedder = await getEmbedder();
  const out: Float32Array[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const result = await embedder(batch, { pooling: 'mean', normalize: true });
    for (const row of result.tolist()) {
      out.push(Float32Array.from(row));
    }
  }

  return out;
}

export async function embedOne(text: string): Promise<Float32Array> {
  const [vec] = await embed([text]);
  return vec;
}

// Both vectors are normalized, so this is cosine similarity.
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// The text actually embedded for a chunk: the video's title and month prepended
// so the vector carries video context, not just the isolated sentence. The bare
// chunk text is what gets stored and shown -- see ingest/chunk.ts.
export function buildEmbeddingText(title: string, publishedAt: string, chunkText: string): string {
  const date = new Date(publishedAt);
  const header = Number.isNaN(date.getTime())
    ? title
    : `${title} (${date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })})`;
  return `${header}\n${chunkText}`;
}
