# SimpleBL

An evidence-based fitness research assistant that surfaces peer-reviewed literature to help lifters make informed decisions. SimpleBL bridges the gap between conflicting research and fitness practitioners by presenting multiple perspectives, citing primary sources, and grounding every claim in real PubMed abstracts.

---

## What It Does

- **Literature Search** — Enter any fitness or training topic to get a structured breakdown: plain-language summary, consensus classification, contrasting perspectives, and direct links to the underlying studies.
- **Inline Citations** — Every claim links back to a specific PubMed article so you can verify it yourself.
- **Honest Uncertainty** — Topics are classified as *Strong Consensus*, *Mixed Evidence*, or *Active Debate* rather than flattening contested science into false confidence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Styling | Tailwind CSS (custom palette + fonts) |
| Backend | Node.js + Express, TypeScript |
| LLM | Groq API (`openai/gpt-oss-120b`) |
| Research Data | NCBI E-utilities (PubMed) |

---

## Project Structure

```
SimpleBL/
├── backend/
│   └── src/
│       ├── index.ts        # Express server + API routes
│       └── pubmed.ts       # PubMed esearch/efetch integration
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
│           └── StudyLink.tsx
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

---

## Design Decisions

- **No vector DB or caching** — PubMed is queried live on every request to keep results current. Latency is acceptable for this use case.
- **Groq over OpenAI** — Chosen for lower latency and cost with the `openai/gpt-oss-120b` model.
- **Structured JSON for search** — The LLM returns a strict schema for the search endpoint, validated and parsed by the backend before sending to the client. Markdown code fences are stripped before `JSON.parse`.
- **Honest uncertainty over false confidence** — Topics with contested evidence are labeled as such rather than picking a side.

---

## License

MIT
