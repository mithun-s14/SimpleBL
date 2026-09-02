// Shared types for the Keenan Wiki transcript RAG feature.

export type TranscriptStatus = 'ok' | 'no_captions' | 'failed';

// One video on the channel, as tracked in the `videos` table.
export interface VideoRecord {
  videoId: string;
  title: string;
  publishedAt: string; // ISO 8601
  durationSeconds: number;
  transcriptStatus: TranscriptStatus;
  ingestedAt: string; // ISO 8601
}

// A raw caption segment as returned by the transcript client, normalized.
export interface CaptionSegment {
  text: string;
  start: number; // seconds
  duration: number; // seconds
}

// A merged time window of speech, before embedding.
export interface Chunk {
  chunkIndex: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

// A chunk as stored, joined with its video for retrieval and citation.
export interface StoredChunk {
  id: string;
  videoId: string;
  chunkIndex: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  publishedAt: string;
}

// A retrieved chunk with its fusion score, ready to become a citation.
export interface RankedChunk extends StoredChunk {
  score: number;
  vectorRank: number | null;
  keywordRank: number | null;
}

// One citation returned to the client.
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
