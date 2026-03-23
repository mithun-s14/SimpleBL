import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

const SEARCH_SYSTEM_PROMPT = `You are a fitness science research assistant. Given a topic, return ONLY a valid JSON object with no markdown code fences, no preamble, and no explanation. The JSON must exactly match this structure:

{
  "topic": "string",
  "summary": "string (2-3 sentences in plain language summarizing the research)",
  "consensus": "strong | mixed | debate",
  "consensusNote": "string (one sentence describing the current state of the evidence)",
  "perspectives": [
    { "label": "string (short label for this view)", "side": "for", "text": "string (1-2 sentences supporting the dominant view)" },
    { "label": "string (short label for this view)", "side": "against", "text": "string (1-2 sentences challenging the dominant view)" }
  ],
  "studies": [
    { "title": "string (author names + year + short title)", "url": "string (real PubMed or Semantic Scholar URL)" },
    { "title": "string", "url": "string" },
    { "title": "string", "url": "string" }
  ]
}

Rules:
- "consensus" must be exactly one of: "strong", "mixed", or "debate"
- "perspectives" must have exactly 2 items — one with side "for", one with side "against"
- "studies" must have exactly 3 items with plausible PubMed (https://pubmed.ncbi.nlm.nih.gov/PMID) or Semantic Scholar URLs
- Return ONLY the raw JSON object. No markdown, no code fences, no extra text.`;

const CHAT_SYSTEM_PROMPT = `You are SimpleBL, an evidence-based fitness assistant for lifters of all levels.

Guidelines:
- Keep responses to 3-5 sentences — concise and research-grounded
- When studies conflict, present both sides and defer the judgment to the user
- Cite studies inline as [Author et al., Year](https://pubmed.ncbi.nlm.nih.gov/PMID) where possible
- Never present contested topics as settled science
- Be accessible to beginners and advanced lifters alike
- Cover: strength/powerlifting, hypertrophy, nutrition/supplementation, recovery, and injury prevention`;

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://simplebl.app',
      'X-Title': 'SimpleBL',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errorText}`);
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

  try {
    const text = await callOpenRouter([
      { role: 'system', content: SEARCH_SYSTEM_PROMPT },
      { role: 'user', content: query.trim() },
    ]);

    // Strip accidental markdown code fences before parsing
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const result = JSON.parse(cleaned);
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

  try {
    const reply = await callOpenRouter([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...messages,
    ]);
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
