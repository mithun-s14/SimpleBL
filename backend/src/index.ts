import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fetchPubMedAbstracts, buildContextBlock, fetchArticleByPmid } from './pubmed';
import { resolvePmcId, fetchPmcFullText } from './pmc';

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
  "summary": "string (2-3 sentences grounded in the retrieved abstracts — be specific: cite effect sizes, sample sizes, and methodologies where available, and mark each cited finding with its bracket number, e.g. [1])",
  "consensus": "strong | mixed | debate",
  "consensusNote": "string (one sentence describing the current state of evidence based on the retrieved literature, with bracket numbers for anything cited)",
  "perspectives": [
    { "label": "string (short label for this view)", "side": "for", "text": "string (1-2 sentences with specific findings from the literature, with bracket numbers for anything cited)" },
    { "label": "string (short label for this view)", "side": "against", "text": "string (1-2 sentences with specific findings or limitations from the literature, with bracket numbers for anything cited)" }
  ],
  "studyRefs": [1, 2, 3]
}

Rules:
- "consensus" must be exactly one of: "strong", "mixed", or "debate"
- "perspectives" must have exactly 2 items — one with side "for", one with side "against"
- Every claim in "summary", "consensusNote", and "perspectives" that draws on the retrieved literature must carry an inline bracket number (e.g. [1]) matching the item it came from.
- "studyRefs" must contain EXACTLY the set of bracket numbers used anywhere in "summary", "consensusNote", or "perspectives" — no more, no fewer — in order of relevance. Do NOT invent numbers that weren't retrieved, do NOT omit any number cited in the text, and do NOT include a number in "studyRefs" that isn't cited in the text.
- Base the summary, consensus, and perspectives on the retrieved abstracts. Do not contradict findings in the provided literature.
- Return ONLY the raw JSON object. No markdown, no code fences, no extra text.`;

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
      model: 'openai/gpt-oss-120b',
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
          pmid: a.pmid,
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

function buildStudyChatSystemPrompt(
  article: { pmid: string; title: string; authors: string; year: string; abstract: string },
  fullText: string | null
): string {
  const source = fullText
    ? `=== FULL TEXT (open-access, via PMC) ===\n${fullText}`
    : `=== ABSTRACT ONLY (full text is not freely available for this study) ===\n${article.abstract}`;

  return `You are a research assistant answering questions about ONE specific study.

Title: ${article.title}
Authors: ${article.authors}${article.year ? ` (${article.year})` : ''}
PMID: ${article.pmid}
URL: https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/

${source}

Rules:
- Answer only using the text provided above. Do not invent methods, numbers, or findings that aren't in it.
- If the user asks something the provided text doesn't cover, say so plainly (e.g. "The abstract doesn't go into that — you'd need the full paper for that detail") and point them to the PubMed link. Never guess.
- ${fullText ? 'You have the full text of the paper, so you can discuss methods, results, and discussion in detail.' : 'You only have the abstract, so avoid claiming specifics (exact statistics, detailed methodology) beyond what it states — be upfront that finer detail requires the full paper, which may sit behind a publisher paywall.'}
- Keep answers concise: 2-4 sentences unless the user asks for more detail.`;
}

app.post('/api/study/chat', async (req: Request, res: Response) => {
  const { pmid, messages } = req.body as {
    pmid?: string;
    messages?: Array<{ role: string; content: string }>;
  };

  if (!pmid || typeof pmid !== 'string' || !pmid.trim()) {
    res.status(400).json({ error: 'pmid is required' });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  const article = await fetchArticleByPmid(pmid.trim());
  if (!article) {
    res.status(404).json({ error: 'Study not found' });
    return;
  }

  const pmcId = await resolvePmcId(article.pmid);
  const fullText = pmcId ? await fetchPmcFullText(pmcId) : null;

  const systemPrompt = buildStudyChatSystemPrompt(article, fullText);

  try {
    const reply = await callLLM([{ role: 'system', content: systemPrompt }, ...messages]);
    res.json({ reply, fullTextAvailable: Boolean(fullText) });
  } catch (err) {
    console.error('[/api/study/chat]', err);
    res.status(500).json({ error: 'Could not get a response. Please try again.' });
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
