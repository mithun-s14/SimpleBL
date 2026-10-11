// Shared types for the SimpleBL eval harness

// A single document retrieved from PubMed and shown to the model
export interface RetrievedDoc {
  pmid: string;
  title: string;
  // The abstract text actually passed to the model in the context block
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

// One labeled example in the eval set
export interface EvalCase {
  id: string;
  question: string;
  // PMIDs judged relevant for this question; fill these in before trusting retrieval scores
  relevantPmids: string[];
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
  retrievedPmids: string[];
  answer: string;
}
