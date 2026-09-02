// Eval harness for the Keenan Wiki corpus.
//
//   npm run eval:keenan
//   npm run eval:keenan -- --limit 3    (Groq's free tier is 8k TPM; these
//                                        prompts are ~3k tokens each)
//
// Reuses precisionAtK / recallAtK / scoreFaithfulness / printReport from the
// PubMed harness -- only the adapter and the labeled set differ. Retrieval is
// the part of this feature most likely to need tuning, so this is the
// regression check to run after touching chunking, RRF, or the glossary.

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { scoreFaithfulness } from './faithfulness';
import { runKeenanQuery } from './keenan-adapter';
import { printReport } from './report';
import { precisionAtK, recallAtK } from './retrieval';
import type { CaseResult, EvalCase } from './types';
import { TOP_K } from '../src/keenan/retrieve';
import { corpusExists, getStats } from '../src/keenan/store';

async function main(): Promise<void> {
  if (!corpusExists()) {
    console.error('No corpus yet. Run: npm run ingest');
    process.exit(1);
  }

  const evalSetPath = path.join(__dirname, './keenan-eval-set.json');
  const all = (JSON.parse(fs.readFileSync(evalSetPath, 'utf-8')) as { cases: EvalCase[] }).cases;

  const limitIndex = process.argv.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(process.argv[limitIndex + 1], 10) : NaN;
  const cases = Number.isNaN(limit) ? all : all.slice(0, limit);

  const labeled = cases.filter((c) => c.relevantIds.length > 0);
  const stats = getStats();

  console.log(`Keenan Wiki eval -- ${stats.videoCount} videos, ${stats.chunkCount} chunks`);
  console.log(`${cases.length} case(s), ${labeled.length} with labels\n`);

  if (labeled.length === 0) {
    console.log(
      'No cases have relevantIds yet, so precision/recall will read 0.\n' +
        'Fill them in from videos you have actually watched -- labeling them from\n' +
        'what the pipeline returns makes the eval measure itself.\n'
    );
  }

  const results: CaseResult[] = [];

  for (const evalCase of cases) {
    console.log(`[${evalCase.id}] ${evalCase.question}`);
    const relevantSet = new Set(evalCase.relevantIds.map(String));

    const start = Date.now();
    const ragResult = await runKeenanQuery(evalCase.question);
    const latencyMs = Date.now() - start;

    const retrievedIds = ragResult.retrievedDocs.map((d) => d.id);
    const precision = precisionAtK(retrievedIds, relevantSet);
    const recall = recallAtK(retrievedIds, relevantSet);

    console.log(`  Retrieved ${retrievedIds.length} video(s) in ${latencyMs}ms`);
    console.log('  Scoring faithfulness...');
    const faithfulness = await scoreFaithfulness(ragResult.answer, ragResult.retrievedDocs);

    console.log(
      `  Done -- faith=${faithfulness.toFixed(2)} p@k=${precision.toFixed(2)} recall=${recall.toFixed(2)}\n`
    );

    results.push({
      caseId: evalCase.id,
      question: evalCase.question,
      precisionAtK: precision,
      recallAtK: recall,
      faithfulness,
      latencyMs,
      // Embeddings run locally and Groq usage is not returned by this path,
      // so per-query cost is not tracked here.
      costUsd: 0,
      retrievedIds,
      answer: ragResult.answer,
    });
  }

  printReport(results, TOP_K);
}

main().catch((err) => {
  console.error('[eval:keenan]', err instanceof Error ? err.message : err);
  process.exit(1);
});
