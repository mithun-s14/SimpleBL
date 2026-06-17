import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { runQuery } from './adapters';
import { precisionAtK, recallAtK } from './retrieval';
import { scoreFaithfulness } from './faithfulness';
import { printReport } from './report';
import type { EvalCase, CaseResult } from './types';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Number of documents the app retrieves per query (retmax=8 in esearch -- see backend/src/pubmed.ts)
const TOP_K = 8;

// Groq pricing for llama-3.3-70b-versatile in USD per million tokens
// https://groq.com/pricing
const INPUT_PRICE_PER_M_TOKENS = 0.59;
const OUTPUT_PRICE_PER_M_TOKENS = 0.79;

function computeCostUsd(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens * INPUT_PRICE_PER_M_TOKENS + completionTokens * OUTPUT_PRICE_PER_M_TOKENS) /
    1_000_000
  );
}

async function main(): Promise<void> {
  const evalSetPath = path.join(__dirname, './eval-set.json');
  const evalSet = JSON.parse(fs.readFileSync(evalSetPath, 'utf-8')) as { cases: EvalCase[] };
  const cases = evalSet.cases;

  console.log(`SimpleBL eval harness -- running ${cases.length} case(s) sequentially\n`);

  const results: CaseResult[] = [];

  for (const evalCase of cases) {
    console.log(`[${evalCase.id}] ${evalCase.question}`);

    const relevantSet = new Set(evalCase.relevantPmids.map(String));

    // Time only the app pipeline, not the faithfulness judge
    const start = Date.now();
    const ragResult = await runQuery(evalCase.question);
    const latencyMs = Date.now() - start;

    const retrievedPmids = ragResult.retrievedDocs.map((d) => d.pmid);
    const precision = precisionAtK(retrievedPmids, relevantSet);
    const recall = recallAtK(retrievedPmids, relevantSet);

    console.log(`  Retrieved ${retrievedPmids.length} doc(s) in ${latencyMs}ms`);
    console.log(`  Scoring faithfulness...`);
    const faith = await scoreFaithfulness(ragResult.answer, ragResult.retrievedDocs);

    const costUsd = ragResult.tokenUsage
      ? computeCostUsd(ragResult.tokenUsage.promptTokens, ragResult.tokenUsage.completionTokens)
      : 0;

    console.log(
      `  Done -- faith=${faith.toFixed(2)} p@k=${precision.toFixed(2)} recall=${recall.toFixed(2)}\n`
    );

    results.push({
      caseId: evalCase.id,
      question: evalCase.question,
      precisionAtK: precision,
      recallAtK: recall,
      faithfulness: faith,
      latencyMs,
      costUsd,
      retrievedPmids,
      answer: ragResult.answer,
    });
  }

  printReport(results, TOP_K);
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
