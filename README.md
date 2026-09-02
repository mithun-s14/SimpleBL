# SimpleBL

An evidence-based fitness research assistant that surfaces peer-reviewed literature to help lifters make informed decisions. SimpleBL bridges the gap between conflicting research and fitness practitioners by presenting multiple perspectives, citing primary sources, and grounding every claim in real PubMed abstracts.

---

## What It Does

- **Literature Search** — Enter any fitness or training topic to get a structured breakdown: plain-language summary, consensus classification, contrasting perspectives, and direct links to the underlying studies.
- **Inline Citations** — Every claim links back to a specific PubMed article so you can verify it yourself.
- **Honest Uncertainty** — Topics are classified as *Strong Consensus*, *Mixed Evidence*, or *Active Debate* rather than flattening contested science into false confidence.
- **Keenan Wiki** *(optional, off by default)* — A second answer source that searches the YouTube transcripts of one creator and answers only from what he actually said, citing the exact timestamp. See [Keenan Wiki](#keenan-wiki).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Styling | Tailwind CSS (custom palette + fonts) |
| Backend | Node.js + Express, TypeScript |
| LLM | Groq API (`openai/gpt-oss-120b`) |
| Research Data | NCBI E-utilities (PubMed) |
| Transcript corpus | SQLite + FTS5 (`better-sqlite3`) |
| Embeddings | `all-MiniLM-L6-v2` run locally via ONNX (384 dims) |

---

## Project Structure

```
SimpleBL/
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express server + API routes
│   │   ├── llm.ts          # Shared Groq client + JSON hardening
│   │   ├── pubmed.ts       # PubMed esearch/efetch integration
│   │   └── keenan/         # Keenan Wiki: store, retrieval, answers, routes
│   ├── ingest/             # Offline transcript ingestion (run with tsx)
│   └── eval/               # Retrieval + faithfulness eval harness
├── frontend/
│   └── src/
│       ├── App.tsx         # Root component
│       ├── types/          # Shared TypeScript interfaces
│       └── components/
│           ├── Header.tsx
│           ├── SearchPanel.tsx
│           ├── TopicChip.tsx
│           ├── ResultCard.tsx
│           ├── PerspectiveBlock.tsx
│           ├── StudyLink.tsx
│           ├── ModeToggle.tsx
│           ├── KeenanPanel.tsx
│           └── KeenanSourceCard.tsx
├── .env.example
├── package.json            # Root workspace scripts
└── PRD.MD                  # Product requirements document
```

---

## Getting Started

### Prerequisites

- Node.js 16+ (LTS recommended)
- A [Groq API key](https://console.groq.com/)

### 1. Clone and install

```bash
git clone <repo-url>
cd SimpleBL
npm run install:all
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and add your Groq API key:

```
GROQ_API_KEY=gsk_your_key_here
PORT=3001
```

### 3. Run in development

```bash
npm run dev
```

This starts both servers concurrently:
- Frontend (Vite): `http://localhost:5173`
- Backend (Express): `http://localhost:3001`

The Vite dev server proxies all `/api/*` requests to the backend automatically.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both backend and frontend in watch mode |
| `npm run install:all` | Install dependencies for both packages |
| `cd backend && npm run build` | Compile backend TypeScript to `dist/` |
| `cd backend && npm run start` | Serve compiled backend (also serves frontend build) |
| `cd frontend && npm run build` | Type-check and bundle frontend |
| `cd frontend && npm run preview` | Preview the production frontend build locally |
| `cd backend && npm run ingest` | Build/update the Keenan transcript corpus |
| `cd backend && npm run search -- "question"` | Inspect retrieval ranking with no LLM involved |
| `cd backend && npm run test:ingest` | Unit tests for chunking, cleaning and citations |
| `cd backend && npm run eval` | Run the PubMed eval harness |
| `cd backend && npm run eval:keenan` | Run the Keenan eval harness |

### Production deployment

```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build

# Start (backend serves the frontend static build)
cd backend && npm run start
```

---

## Architecture & Data Flow

### Search

```
User query (SearchPanel)
    → POST /api/search
    → PubMed esearch: find up to 8 relevant PMIDs
    → PubMed efetch: retrieve full abstracts
    → Groq LLM: generate structured JSON response
    ← { topic, summary, consensus, perspectives[], studies[] }
    → Render ResultCard with badges and citation pills
```

---

## API Endpoints

### `POST /api/search`

**Body:**
```json
{ "query": "progressive overload hypertrophy" }
```

**Response:**
```json
{
  "topic": "Progressive Overload and Muscle Hypertrophy",
  "summary": "...",
  "consensusNote": "...",
  "consensus": "strong",
  "perspectives": [
    { "side": "for", "claim": "...", "detail": "..." },
    { "side": "against", "claim": "...", "detail": "..." }
  ],
  "studies": [
    { "pmid": "12345678", "title": "...", "authors": "...", "year": 2022, "url": "https://pubmed.ncbi.nlm.nih.gov/12345678" }
  ]
}
```

**Consensus values:** `"strong"` | `"mixed"` | `"debate"`

---

## How PubMed Integration Works

`backend/src/pubmed.ts` queries the NCBI E-utilities API in two steps:

1. **esearch** — Converts the user query into a fitness-domain PubMed search (strips stop words, adds domain filters like `exercise OR "resistance training"`), returns up to 8 PMIDs.
2. **efetch** — Retrieves full XML article records for those PMIDs, parses title, authors, year, and abstract.

The retrieved abstracts are injected into the LLM system prompt so the model grounds its response in real published research rather than generating from parametric knowledge alone.

A 340ms delay is added between requests to respect NCBI's rate limit of 3 requests/second. The function never throws — it returns an empty array on any failure so the app degrades gracefully.

---

## UI Components

| Component | Role |
|---|---|
| `Header` | Logo and tagline |
| `SearchPanel` | Query input, topic chips, result rendering, loading skeleton |
| `TopicChip` | Preset query buttons (e.g., "Creatine", "Sleep & Recovery") |
| `ResultCard` | Full structured result with badge, summary, perspectives, citations |
| `PerspectiveBlock` | Color-coded "for" (green) / "against" (coral) argument blocks |
| `StudyLink` | Citation pill with external PubMed link |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | API key for Groq LLM requests |
| `PORT` | No | Backend port (default: `3001`) |
| `KEENAN_WIKI_ENABLED` | No | `true` to serve `/api/keenan/*` (default: off) |
| `KEENAN_CHANNEL_ID` | Ingest only | `UC...` channel ID, or an `@handle` |
| `YOUTUBE_API_KEY` | No | Data API key; without it discovery falls back to `youtubei.js` |
| `KEENAN_PYTHON` | Ingest only | Interpreter with `youtube-transcript-api` installed |
| `KEENAN_DB_PATH` | No | Corpus location (default: `backend/data/keenan.db`) |
| `KEENAN_DB_URL` | No | Fetch the corpus from this URL at boot |
| `KEENAN_EMBEDDING_MODEL` | No | Default `Xenova/all-MiniLM-L6-v2`; changing it forces a re-embed |
| `KEENAN_ANSWER_MODEL` | No | Default `openai/gpt-oss-120b` |

The frontend reads `VITE_API_BASE_URL` and `VITE_KEENAN_WIKI_ENABLED` at **build** time — a server-side variable cannot gate a static bundle.

---

## Keenan Wiki

An optional second answer source: instead of PubMed abstracts, it retrieves from the YouTube transcripts of [Keenan Malloy](https://www.youtube.com/@Keenanrmalloy) and answers only from what he actually said, linking each citation to the exact timestamp.

It is **off by default** and gated behind two flags (`KEENAN_WIKI_ENABLED` on the server, `VITE_KEENAN_WIKI_ENABLED` at frontend build time), so it can ship dark.

### How it works

```
YouTube  →  captions  →  clean  →  chunk (75s windows, 15s overlap)  →  embed  →  keenan.db
   (backend/ingest, run offline — never on the web server)                            │
                                                                                      ▼
              question  →  hybrid retrieval (vector + FTS5, fused by RRF)  ←  loaded at boot
                                              │
                                    Groq (openai/gpt-oss-120b)
                                              │
                              answer + timestamped source cards
```

Retrieval is hybrid because exact terminology carries the meaning here ("RIR", "lengthened partials", "junk volume") and embeddings blur those together. Dense and keyword candidate lists are fused by reciprocal rank, then deduplicated (he repeats advice across hundreds of videos) and capped at 3 chunks per video.

As in `/api/search`, the model is only ever trusted to say *which* excerpts it used — every ID, title, URL and timestamp is rebuilt server-side from stored records.

### Setup

```bash
# 1. Captions come via youtube-transcript-api: YouTube now requires a PO token
#    for direct timedtext requests, so the Node clients return empty bodies.
python3 -m venv .venv && ./.venv/bin/pip install -r backend/ingest/requirements.txt

# 2. Point .env at the channel and the interpreter
#    KEENAN_CHANNEL_ID=UCZMLNVZW6RVGzyYOfos4TYg
#    KEENAN_PYTHON=./.venv/bin/python
#    KEENAN_WIKI_ENABLED=true

# 3. Try a few videos before the full channel, and read the output
cd backend && npm run ingest -- --limit 5

# 4. Tune retrieval with no LLM in the loop
npm run search -- "how many RIR should I leave"

# 5. Backfill everything (~45 chunks per hour-long video)
npm run ingest
```

Then set `VITE_KEENAN_WIKI_ENABLED=true` (e.g. in `frontend/.env.local`) to show the tab.

### Ingestion runs offline, on purpose

YouTube rate-limits and IP-blocks caption requests from cloud provider ranges, so ingestion must **not** run on the production web server. `.github/workflows/keenan-ingest.yml` runs it daily and publishes `keenan.db` as a release asset; set `KEENAN_DB_URL` and the backend fetches it at boot and refreshes periodically. If GitHub's IPs get blocked too, run `npm run ingest` on a local cron — the script has no CI-specific dependencies.

Ingestion is incremental and idempotent: it walks the uploads feed newest-first, stops at the first video it already has, retries transient failures, and never retries videos that genuinely have no captions.

### API

`POST /api/keenan/ask` → `{ answer, sources[], sufficientContext }`

`sufficientContext` is `false` when the transcripts do not actually cover the question. The UI renders that case distinctly rather than dressing a hedged non-answer up as an answer.

`GET /api/keenan/stats` → corpus coverage, also useful as a health check.

Both return `503` when the feature is disabled or the corpus is missing. The ask endpoint is capped at 20 requests/hour per IP.

### Content handling

The transcripts are the creator's work. The feature never displays full transcripts, keeps source-card excerpts to a sentence or two, credits the channel on the page, and links every claim back to the video at the relevant moment. The corpus is a single file, so the data can be purged and ingestion disabled at once if he ever asks.

---

## License

MIT
