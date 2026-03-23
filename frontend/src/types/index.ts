export type ConsensusLevel = 'strong' | 'mixed' | 'debate';
export type PerspectiveSide = 'for' | 'against';

export interface Study {
  title: string;
  url: string;
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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
