import { SearchResult, ConsensusLevel } from '../types';
import PerspectiveBlock from './PerspectiveBlock';
import StudyLink from './StudyLink';

interface ResultCardProps {
  result: SearchResult;
}

const CONSENSUS_CONFIG: Record<
  ConsensusLevel,
  { label: string; bg: string; text: string; dot: string }
> = {
  strong: {
    label: 'Strong Consensus',
    bg: 'bg-brand-green-light',
    text: 'text-brand-green-dark',
    dot: 'bg-brand-green',
  },
  mixed: {
    label: 'Mixed Evidence',
    bg: 'bg-brand-amber-light',
    text: 'text-brand-amber-dark',
    dot: 'bg-amber-400',
  },
  debate: {
    label: 'Active Debate',
    bg: 'bg-brand-coral-light',
    text: 'text-brand-coral-dark',
    dot: 'bg-brand-coral',
  },
};

export default function ResultCard({ result }: ResultCardProps) {
  const consensus = CONSENSUS_CONFIG[result.consensus] ?? CONSENSUS_CONFIG.mixed;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-slide-up">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-[15px] font-semibold text-gray-900 leading-snug">{result.topic}</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${consensus.bg} ${consensus.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${consensus.dot}`} />
          {consensus.label}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-600 leading-relaxed mb-1.5">{result.summary}</p>
      <p className="text-xs text-gray-400 italic mb-5">{result.consensusNote}</p>

      {/* Perspectives */}
      <div className="mb-5">
        <h3 className="text-[10px] font-semibold font-mono uppercase tracking-widest text-gray-400 mb-2.5">
          Perspectives
        </h3>
        <div className="space-y-2.5">
          {result.perspectives.map((p, i) => (
            <PerspectiveBlock key={i} perspective={p} />
          ))}
        </div>
      </div>

      {/* Studies */}
      {result.studies.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold font-mono uppercase tracking-widest text-gray-400 mb-2.5">
            Studies
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.studies.map((study, i) => (
              <StudyLink key={i} study={study} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
