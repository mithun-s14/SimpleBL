// Shared types for the SimpleBL eval harness

// A single document retrieved and shown to the model. `id` is whatever
// identifies a source in that corpus: a PMID for PubMed, a YouTube video ID
// for the Keenan transcripts.
export interface RetrievedDoc {
  id: string;
  title: string;
  // The text actually passed to the model in the context block
  text: string;
}

// What the RAG pipeline returns for one question
export interface RagResult {
  answer: string;
  retrievedDocs: RetrievedDoc[];
  // Token usage from the Groq response, if available
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// One labeled example in the eval set. `relevantIds` holds PMIDs for the
// PubMed set and YouTube video IDs for the Keenan set.
export interface EvalCase {
  id: string;
  question: string;
  // Judged relevant for this question; fill these in before trusting retrieval scores
  relevantIds: string[];
}

// Scores and metadata for a single eval case after running it
export interface CaseResult {
  caseId: string;
  question: string;
  precisionAtK: number;
  recallAtK: number;
  faithfulness: number;
  latencyMs: number;
  costUsd: number;
  retrievedIds: string[];
  answer: string;
}
