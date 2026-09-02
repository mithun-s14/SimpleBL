// Express routes for the Keenan Wiki.
//
// Mounted from index.ts. Kept in its own module so the feature is one directory
// that can be deleted wholesale if the creator ever asks for it to come down.

import type { Express, Request, Response } from 'express';
import { askKeenan } from './ask';
import { corpusExists, getStats, isEnabled } from './store';

// No auth and no limiter exist in this app, and the backend runs deliberately
// thin on dependencies, so this is a small in-memory cap rather than
// express-rate-limit. It resets on redeploy, which is fine at this stage.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.KEENAN_RATE_LIMIT ?? 20);
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Bound the map so a long-lived process cannot grow it without limit.
  if (hits.size > 10_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key);
    }
  }

  return recent.length > RATE_LIMIT_MAX;
}

// The feature ships dark: off unless explicitly enabled and a corpus is present.
function unavailable(res: Response): boolean {
  if (isEnabled()) return false;
  res.status(503).json({
    error: corpusExists()
      ? 'Keenan Wiki is disabled on this server.'
      : 'The Keenan Wiki corpus has not been built yet.',
  });
  return true;
}

export function registerKeenanRoutes(app: Express): void {
  app.get('/api/keenan/stats', (_req: Request, res: Response) => {
    if (unavailable(res)) return;
    try {
      res.json(getStats());
    } catch (err) {
      console.error('[/api/keenan/stats]', err);
      res.status(500).json({ error: 'Could not read corpus stats.' });
    }
  });

  app.post('/api/keenan/ask', async (req: Request, res: Response) => {
    if (unavailable(res)) return;

    const { question, history } = req.body as {
      question?: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    if (rateLimited(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'Too many questions for now. Try again later.' });
      return;
    }

    try {
      const result = await askKeenan(question.trim(), Array.isArray(history) ? history : []);
      res.json(result);
    } catch (err) {
      console.error('[/api/keenan/ask]', err);
      if (err instanceof SyntaxError) {
        res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
      } else {
        res.status(500).json({ error: 'Could not get an answer. Please try again.' });
      }
    }
  });
}
