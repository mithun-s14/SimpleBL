// Retrieval scoring functions for evaluating PubMed document retrieval quality

// Precision@k: fraction of retrieved documents that are labeled relevant
export function precisionAtK(retrieved: string[], relevant: Set<string>): number {
  if (retrieved.length === 0) return 0;
  const hits = retrieved.filter((pmid) => relevant.has(pmid)).length;
  return hits / retrieved.length;
}

// Recall@k: fraction of labeled relevant documents that were retrieved
export function recallAtK(retrieved: string[], relevant: Set<string>): number {
  if (relevant.size === 0) return 0;
  const hits = retrieved.filter((pmid) => relevant.has(pmid)).length;
  return hits / relevant.size;
}
