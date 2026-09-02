export type ConsensusLevel = 'strong' | 'mixed' | 'debate';
export type PerspectiveSide = 'for' | 'against';

export interface Study {
  pmid: string;
  title: string;
  url: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Perspective {
  label: string;
  side: PerspectiveSide;
  text: string;
}

export interface SearchResult {
  topic: string;
  summary: string;
  consensus: ConsensusLevel;
  consensusNote: string;
  perspectives: Perspective[];
  studies: Study[];
}

// --- Keenan Wiki ----------------------------------------------------------

export interface KeenanSource {
  videoId: string;
  title: string;
  publishedAt: string;
  startSeconds: number;
  url: string;
  excerpt: string;
}

export interface KeenanAnswer {
  answer: string;
  sources: KeenanSource[];
  // False when the transcripts do not actually cover the question. The UI must
  // render this differently -- a hedged non-answer is not an answer.
  sufficientContext: boolean;
}

export interface KeenanStats {
  videoCount: number;
  chunkCount: number;
  earliestPublishedAt: string | null;
  latestPublishedAt: string | null;
  lastIngestAt: string | null;
  embeddingModel: string | null;
}
