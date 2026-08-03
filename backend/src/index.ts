import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fetchPubMedAbstracts, buildContextBlock } from './pubmed';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

const SEARCH_SYSTEM_PROMPT = `You are a fitness science research assistant. Given a topic and retrieved PubMed literature, return ONLY a valid JSON object with no markdown code fences, no preamble, and no explanation. The JSON must exactly match this structure:

{
  "topic": "string",
  "summary": "string (2-3 sentences grounded in the retrieved abstracts — be specific: cite effect sizes, sample sizes, and methodologies where available)",
  "consensus": "strong | mixed | debate",
  "consensusNote": "string (one sentence describing the current state of evidence based on the retrieved literature)",
  "perspectives": [
    { "label": "string (short label for this view)", "side": "for", "text": "string (1-2 sentences with specific findings from the literature)" },
    { "label": "string (short label for this view)", "side": "against", "text": "string (1-2 sentences with specific findings or limitations from the literature)" }
  ],
  "studyRefs": [1, 2, 3]
}

Rules:
- "consensus" must be exactly one of: "strong", "mixed", or "debate"
- "perspectives" must have exactly 2 items — one with side "for", one with side "against"
- "studyRefs" must contain ONLY the bracket numbers (e.g. 1, 2, 3) of items from the retrieved literature above that you actually used, in order of relevance. Do NOT invent numbers that weren't retrieved. Include as many as were retrieved (up to 3); if fewer than 3 were retrieved, the array may have fewer than 3 items.
- Base the summary, consensus, and perspectives on the retrieved abstracts. Do not contradict findings in the provided literature.
- Return ONLY the raw JSON object. No markdown, no code fences, no extra text.`;

const CHAT_SYSTEM_PROMPT = `You are SimpleBL, an evidence-based fitness assistant for lifters of all levels.

Guidelines:
- Keep responses to 3-5 sentences — concise and research-grounded
- When studies conflict, present both sides and defer the judgment to the user
- Cite studies inline using bracket reference numbers matching the retrieved literature above, e.g. "...increases hypertrophy [1]." Do not write out URLs or author names yourself — just the bracket number. If no literature was retrieved, do not include any citation brackets at all
- Be specific: reference sample sizes, effect sizes, and study designs when the retrieved abstracts provide them
- Never present contested topics as settled science
- Do not fabricate study findings — if the retrieved abstracts do not cover part of the question, say so
- Be accessible to beginners and advanced lifters alike`;

async function callLLM(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq ${response.status}: ${text}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0].message.content;
}

app.post('/api/search', async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };

  if (!query || typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  const trimmed = query.trim();

  // Fetch real PubMed abstracts — never throws, returns [] on failure
  const abstracts = await fetchPubMedAbstracts(trimmed);
  const contextBlock = buildContextBlock(abstracts);

  const systemPrompt = contextBlock
    ? `${contextBlock}\n\n${SEARCH_SYSTEM_PROMPT}`
    : SEARCH_SYSTEM_PROMPT;

  try {
    const text = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: trimmed },
    ]);

    // Strip accidental markdown code fences before parsing
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Escape literal control characters inside JSON string values
    const sanitized = cleaned.replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    );

    const result = JSON.parse(sanitized);

    // Build studies from real fetched abstracts — never trust the LLM to
    // transcribe PMIDs/titles/URLs itself, only which indices it referenced
    const refs: unknown = result.studyRefs;
    const studyRefs = Array.isArray(refs) ? refs : [];
    delete result.studyRefs;
    const seen = new Set<number>();
    result.studies = studyRefs
      .filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= abstracts.length)
      .filter((n) => (seen.has(n) ? false : (seen.add(n), true)))
      .map((n) => {
        const a = abstracts[n - 1];
        return {
          title: `${a.authors}, ${a.year} — ${a.title}`,
          url: `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
        };
      });

    res.json(result);
  } catch (err) {
    console.error('[/api/search]', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    } else {
      res.status(500).json({ error: 'Could not load results. Please try again.' });
    }
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages } = req.body as {
    messages?: Array<{ role: string; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // Search PubMed based on the most recent user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  console.log(`[chat] last user message: "${lastUserMsg?.content.slice(0, 80)}"`);
  const abstracts = lastUserMsg ? await fetchPubMedAbstracts(lastUserMsg.content) : [];
  const contextBlock = buildContextBlock(abstracts);

  const systemPrompt = contextBlock
    ? `${contextBlock}\n\n${CHAT_SYSTEM_PROMPT}`
    : CHAT_SYSTEM_PROMPT;

  try {
    const rawReply = await callLLM([
      { role: 'system', content: systemPrompt },
      ...messages,
    ]);

    // Replace [n] bracket refs with real markdown citation links built from
    // the actual fetched abstracts — never trust the LLM to write URLs itself
    const reply = rawReply.replace(/\[(\d+)\]/g, (match, numStr) => {
      const n = Number(numStr);
      if (!Number.isInteger(n) || n < 1 || n > abstracts.length) return match;
      const a = abstracts[n - 1];
      return `[${a.authors}, ${a.year}](https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/)`;
    });

    res.json({ reply });
  } catch (err) {
    console.error('[/api/chat]', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Serve built frontend in production
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
app.use(express.static(FRONTEND_DIST));
app.get('*', (_req: Request, res: Response) => {
  const index = path.join(FRONTEND_DIST, 'index.html');
  res.sendFile(index, (err) => {
    if (err) {
      res.status(200).send(`
        <pre style="font-family:monospace;padding:2rem">
SimpleBL backend is running on port ${PORT}.

In development, open the Vite dev server instead:
  http://localhost:5173

For production, build the frontend first:
  cd frontend && npm run build
        </pre>
      `);
    }
  });
});

app.listen(PORT, () => {
  console.log(`SimpleBL backend running on http://localhost:${PORT}`);
});
