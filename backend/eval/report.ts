import type { CaseResult } from './types';

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Nearest-rank percentile (1-indexed). Input array must be pre-sorted ascending.
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1];
}

export function printReport(results: CaseResult[], k: number): void {
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const meanPrecision = mean(results.map((r) => r.precisionAtK));
  const meanRecall = mean(results.map((r) => r.recallAtK));
  const meanFaith = mean(results.map((r) => r.faithfulness));
  const meanCost = mean(results.map((r) => r.costUsd));
  const p50 = percentile(latencies, 50);
  const p99 = percentile(latencies, 99);

  console.log('\n========================================');
  console.log('EVAL REPORT');
  console.log('========================================');
  console.log(`Cases run:           ${results.length}`);
  console.log(`Retrieval top-k:     ${k}`);
  console.log(`Mean precision@${k}:  ${meanPrecision.toFixed(3)}`);
  console.log(`Mean recall@${k}:     ${meanRecall.toFixed(3)}`);
  console.log(`Mean faithfulness:   ${meanFaith.toFixed(3)}`);
  console.log(`Latency p50:         ${p50.toFixed(0)} ms`);
  console.log(`Latency p99:         ${p99.toFixed(0)} ms`);
  console.log(`Mean cost/query:     $${meanCost.toFixed(5)}`);
  console.log('========================================');

  console.log('\nPer-case breakdown:');
  for (const r of results) {
    console.log(
      `\n[${r.caseId}]` +
        ` p@k=${r.precisionAtK.toFixed(2)}` +
        ` recall=${r.recallAtK.toFixed(2)}` +
        ` faith=${r.faithfulness.toFixed(2)}` +
        ` latency=${r.latencyMs}ms` +
        ` cost=$${r.costUsd.toFixed(5)}`
    );
    console.log(`  Q: ${r.question}`);
    console.log(`  PMIDs retrieved: ${r.retrievedPmids.join(', ') || 'none'}`);
    // Truncate long answers so the report stays readable
    const snippet = r.answer.length > 140 ? r.answer.slice(0, 140) + '...' : r.answer;
    console.log(`  A: ${snippet}`);
  }
  console.log();
}
