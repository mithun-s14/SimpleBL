import dotenv from 'dotenv';
import path from 'path';
import { groqFetchWithRetry } from './groq-retry';
import type { RetrievedDoc } from './types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_JUDGE_MODEL = 'llama-3.3-70b-versatile';

// Override with GROQ_JUDGE_MODEL env var to use a different model for the judge
function getJudgeModel(): string {
  return process.env.GROQ_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
}

interface ClaimVerdict {
  claim: string;
  verdict: 'supported' | 'partial' | 'unsupported';
  reason: string;
}

interface JudgeResponse {
  claims: ClaimVerdict[];
}

// Weighted score per verdict: supported=1.0, partial=0.5, unsupported=0.0
const VERDICT_WEIGHTS: Record<string, number> = {
  supported: 1.0,
  partial: 0.5,
  unsupported: 0.0,
};

const JUDGE_SYSTEM_PROMPT = `You are a faithfulness evaluator for a medical research assistant.
Your job is to assess whether claims made in an answer are grounded in the provided source documents.

Steps:
1. Break the answer into individual atomic claims (one verifiable fact per claim, ignore filler phrases).
2. For each claim rate it as exactly one of:
   - "supported": directly confirmed by one or more source documents
   - "partial": partially confirmed but missing key qualifications or caveats present in the sources
   - "unsupported": contradicts the sources, extrapolates beyond them, or cannot be verified from them
3. Return ONLY a JSON object -- no preamble, no explanation outside the JSON -- with this structure:
{
  "claims": [
    { "claim": "string", "verdict": "supported" | "partial" | "unsupported", "reason": "string" }
  ]
}`;

// Score faithfulness of an answer against the retrieved source documents.
// Returns a value in [0, 1]: 1 = all claims supported, 0 = no claims supported.
export async function scoreFaithfulness(
  answer: string,
  sourceDocs: RetrievedDoc[]
): Promise<number> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  if (!answer.trim()) return 0;
  if (sourceDocs.length === 0) return 0;

  const sourcesText = sourceDocs
    .map((d, i) => `[${i + 1}] PMID: ${d.pmid}\nTitle: ${d.title}\n${d.text}`)
    .join('\n\n');

  const userPrompt = `ANSWER TO EVALUATE:\n${answer}\n\nSOURCE DOCUMENTS:\n${sourcesText}`;

  const response = await groqFetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getJudgeModel(),
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq judge ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  let parsed: JudgeResponse;
  try {
    parsed = JSON.parse(data.choices[0].message.content) as JudgeResponse;
  } catch {
    throw new Error(`Judge returned non-JSON: ${data.choices[0].message.content.slice(0, 200)}`);
  }

  const claims = parsed.claims;
  if (!Array.isArray(claims) || claims.length === 0) return 0;

  const totalWeight = claims.reduce((sum, c) => sum + (VERDICT_WEIGHTS[c.verdict] ?? 0), 0);
  return totalWeight / claims.length;
}
