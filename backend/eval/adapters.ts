// Wires the eval harness to the real SimpleBL pipeline.
// Mirrors the /api/chat route in backend/src/index.ts, but calls Groq directly
// so that token usage is captured and returned to the caller.

import dotenv from 'dotenv';
import path from 'path';
import { fetchPubMedAbstracts, buildContextBlock } from '../src/pubmed';
import { groqFetchWithRetry } from './groq-retry';
import type { RagResult, RetrievedDoc } from './types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Mirrors CHAT_SYSTEM_PROMPT in backend/src/index.ts -- keep in sync if that prompt changes
const SYSTEM_PROMPT = `You are SimpleBL, an evidence-based fitness assistant for lifters of all levels.

Guidelines:
- Keep responses to 3-5 sentences -- concise and research-grounded
- When studies conflict, present both sides and defer the judgment to the user
- Cite studies inline as [Author et al., Year](https://pubmed.ncbi.nlm.nih.gov/PMID) -- use ONLY exact PMIDs from the retrieved literature above. Do NOT fabricate or guess PMIDs. If no literature was retrieved, do not include any citation links at all
- Be specific: reference sample sizes, effect sizes, and study designs when the retrieved abstracts provide them
- Never present contested topics as settled science
- Do not fabricate study findings -- if the retrieved abstracts do not cover part of the question, say so
- Be accessible to beginners and advanced lifters alike`;

interface GroqChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

// Run one question through the full pipeline: PubMed retrieval + Groq answer generation.
// Returns the retrieved docs (pmid, title, abstract text shown to the model), the answer,
// and token usage from the Groq response if available.
export async function runQuery(question: string): Promise<RagResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const abstracts = await fetchPubMedAbstracts(question);
  const contextBlock = buildContextBlock(abstracts);

  const systemPrompt = contextBlock ? `${contextBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;

  const response = await groqFetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq ${response.status}: ${text}`);
  }

  const data = (await response.json()) as GroqChatResponse;
  const answer = data.choices[0].message.content;

  const retrievedDocs: RetrievedDoc[] = abstracts.map((a) => ({
    pmid: a.pmid,
    title: a.title,
    // Use the abstract as the text field -- this is the snippet passed to the model
    text: a.abstract,
  }));

  const tokenUsage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      }
    : undefined;

  return { answer, retrievedDocs, tokenUsage };
}
