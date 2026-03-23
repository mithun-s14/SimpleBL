# SimpleBl — Product Requirements Document

**Version:** 1.0  
**Prepared for:** Claude CLI / Claude Code  
**Product type:** Full-stack web application  

---

## 1. Overview

SimpleBL is an evidence-based fitness assistant that helps lifters at all levels navigate conflicting research. It combines a literature search tool and a conversational AI chat interface, both powered by OpenRouter. The app surfaces peer-reviewed studies, presents multiple perspectives on contested topics, and lets users form their own conclusions rather than being handed a single opinion.

---

## 2. Goals

- Give lifters a single, trustworthy place to explore the science behind training decisions.
- Surface genuine research disagreements rather than flattening them into false consensus.
- Be accessible to both beginners and experienced lifters with no assumed prior knowledge.
- Cite sources inline so claims are verifiable.

---

## 3. Target Users

- **Beginners** who want to understand the fundamentals without sifting through contradictory Reddit threads.
- **Intermediate/advanced lifters** who want to go deeper on contested topics (e.g. optimal training frequency, rep ranges for hypertrophy, protein timing).

---

## 4. Core Features

### 4.1 Literature Search

The primary interface. Users enter a topic or click a preset category chip. The app queries OpenRouter and returns a structured breakdown of the research.

**Search input:**
- Free-text input field (keyboard submit supported)
- Preset topic chips: Strength, Hypertrophy, Nutrition, Recovery, Creatine, Injury Prevention, Cardio

**Result card anatomy:**
- Topic heading
- 2-3 sentence research summary in plain language
- Consensus badge: one of `Strong consensus`, `Mixed evidence`, or `Active debate`
- One-sentence note on the state of the evidence
- Two competing perspectives (labeled "for" and "against" the dominant view) so the user can decide
- Linked study citations (inline pill-style links pointing to PubMed or Semantic Scholar)

**API call for search:**
- Endpoint: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible)
- Model: `anthropic/claude-sonnet-4-5` (or swap for any OpenRouter-supported model)
- System prompt instructs the model to return only valid JSON with the shape described in section 7
- Parse response as JSON and render dynamically

### 4.2 AI Chat

A conversational interface for nuanced or follow-up questions. Maintains full conversation history within the session.

**Behavior:**
- Bot introduces itself on first load
- Responses are 3-5 sentences, concise and research-grounded
- When studies conflict the bot presents both sides and defers the judgment to the user
- Inline markdown citation links formatted as `[Author et al., Year](URL)` are rendered as styled pill links
- Full `messages` history array is passed on every API call so context is preserved across turns

**API call for chat:**
- Endpoint: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible)
- Model: `anthropic/claude-sonnet-4-5` (or swap for any OpenRouter-supported model)
- System prompt frames the assistant as SimpleBL and instructs it to cite real PubMed links where possible

---

## 5. Topics Covered

The app covers four domains:

- **Strength and powerlifting** — progressive overload, periodization, 1RM protocols, intensity vs. volume tradeoffs
- **Hypertrophy and muscle building** — rep ranges, volume landmarks, frequency, mind-muscle connection, mechanical tension vs. metabolic stress
- **Nutrition and supplementation** — protein intake, meal timing, creatine, caffeine, caloric surplus/deficit for body recomposition
- **Recovery and injury prevention** — sleep quality, deload strategy, active recovery, overtraining, warm-up protocols

---

## 6. Handling Conflicting Research

This is a core product value. When evidence is mixed the app must:

- Never pick a side or present one study as definitively correct
- Label the consensus state honestly (`Strong consensus`, `Mixed evidence`, or `Active debate`)
- Render two labeled perspective blocks, one "for" and one "against" the mainstream view
- Link to the primary studies behind each perspective so users can read them directly

---

## 7. API Response Schema (Search)

The search flow expects OpenRouter to return the following JSON. The system prompt must instruct the model to return only this structure with no markdown fences or preamble:

```json
{
  "topic": "string",
  "summary": "string (2-3 sentences, plain language)",
  "consensus": "strong | mixed | debate",
  "consensusNote": "string (one sentence)",
  "perspectives": [
    { "label": "string", "side": "for | against", "text": "string" },
    { "label": "string", "side": "for | against", "text": "string" }
  ],
  "studies": [
    { "title": "string", "url": "string (PubMed or Semantic Scholar URL)" },
    { "title": "string", "url": "string" },
    { "title": "string", "url": "string" }
  ]
}
```

Strip any accidental markdown code fences before `JSON.parse()`.

---

## 8. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | React (Vite) + TypeScript | Single-page app, strict mode enabled |
| Styling | Tailwind CSS | Utility-first, keep it clean |
| API | OpenRouter `/v1/chat/completions` | OpenAI-compatible; proxied through a thin backend to avoid exposing keys |
| Backend | Node.js + Express + TypeScript | Compiled with `tsc`, or run directly with `tsx` for dev |
| Citations | PubMed / Semantic Scholar links | Generated by the model, not a live API call |
| Deployment | Vercel or Railway | Either works; app is stateless |

---

## 9. Backend API Routes

### POST `/api/search`

Request body:
```json
{ "query": "string" }
```

Response: the parsed JSON object from section 7.

The backend forwards the query to OpenRouter with the structured JSON system prompt, parses the response, and returns it. It catches JSON parse failures and returns a 500 with a descriptive error.

**OpenRouter request shape (backend):**
```ts
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://your-app-domain.com",
    "X-Title": "SimpleBL"
  },
  body: JSON.stringify({
    model: "anthropic/claude-sonnet-4-5",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: query }
    ]
  })
});

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

const data: OpenRouterResponse = await response.json();
const text = data.choices[0].message.content;
```

### POST `/api/chat`

Request body:
```json
{
  "messages": [
    { "role": "user | assistant", "content": "string" }
  ]
}
```

Response:
```json
{ "reply": "string" }
```

The backend appends the system prompt and forwards the full messages array to OpenRouter. It returns only the assistant reply text.

---

## 10. Frontend Component Structure

```
src/
  types/
    index.ts            — Shared types: SearchResult, Perspective, Study, ChatMessage
  components/
    Header.tsx          — Logo, app name, tagline
    TabBar.tsx          — Toggle between Search and Chat views
    SearchPanel.tsx     — Search input, topic chips, result rendering
    TopicChip.tsx       — Individual chip with active state
    ResultCard.tsx      — Full result card (summary, consensus, perspectives, studies)
    PerspectiveBlock.tsx — Single "for" or "against" perspective with colored left border
    StudyLink.tsx       — Pill-style citation link
    ChatPanel.tsx       — Message list + input bar
    ChatMessage.tsx     — Individual message bubble (user or bot)
  App.tsx
  main.tsx
```

**Key types (`src/types/index.ts`):**
```ts
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
```

---

## 11. UI Design Spec

**Color palette:**
- Primary green: `#1D9E75` (buttons, active states, "for" perspective border)
- Light green surface: `#E1F5EE` (for-perspective background, chip active background)
- Coral/orange: `#D85A30` (against-perspective border)
- Light coral surface: `#FAECE7` (against-perspective background)
- Amber: for "mixed evidence" badge (`#FAEEDA` bg, `#633806` text)

**Consensus badge colors:**
- Strong consensus: green (`#E1F5EE` bg, `#085041` text)
- Mixed evidence: amber (`#FAEEDA` bg, `#633806` text)
- Active debate: coral (`#FAECE7` bg, `#4A1B0C` text)

**Typography:**
- System sans-serif stack, no custom fonts required
- Body: 14px / 1.6 line height
- Card headings: 15px / 500 weight

**Layout:**
- Max content width: 720px, centered
- Cards: white background, 1px border (`#e5e7eb`), 12px border radius, 16-20px padding
- Tab bar: pill-style toggle, gray background, white active tab

---

## 12. State Management

All state is local to the React component tree using typed `useState` hooks. No external state library is needed.

- `searchQuery: string` — current text input value
- `searchResult: SearchResult | null` — parsed result object from the last successful search
- `searchLoading: boolean` — loading state
- `activeTab: 'search' | 'chat'` — active tab
- `chatMessages: ChatMessage[]` — conversation history
- `chatLoading: boolean` — chat loading state
- `activeChip: string | null` — which preset chip is currently selected

Chat history resets on page refresh. No persistence is required in v1.

---

## 13. Error Handling

- If OpenRouter returns a non-200 or the JSON parse fails, show an inline error message inside the result area: "Could not load results. Please try again."
- If the chat API fails, show an error bubble from the bot: "Something went wrong. Please try again."
- The backend should log errors server-side and return a clean 500 JSON response: `{ "error": "string" }`.
- Never expose the raw API key in frontend code. The key lives in a `.env` file read only by the backend.

---

## 14. Environment Variables
The environment variables are in .env

```
OPENROUTER_API_KEY=sk-or-...
PORT=3001
```

The OpenRouter API key is passed as a `Bearer` token in the `Authorization` header on every request. Optionally set `HTTP-Referer` and `X-Title` headers for OpenRouter dashboard tracking:

```
HTTP-Referer: https://your-app-domain.com
X-Title: SimpleBL
```

The frontend is configured to proxy `/api/*` requests to the backend during development (Vite `proxy` config) and to the same domain in production.

**TypeScript config notes:**
- Frontend: `tsconfig.json` with `"strict": true`, `"jsx": "react-jsx"`, target `ES2020`
- Backend: separate `tsconfig.json` with `"module": "commonjs"`, `"outDir": "./dist"`, `"rootDir": "./src"`
- Install `@types/express` and `@types/node` as dev dependencies on the backend
- Use `tsx` for dev (`npx tsx watch src/index.ts`) and `tsc` for production builds

---

## 15. Out of Scope for v1

- User accounts or saved history
- Live PubMed API integration (model-generated URLs are acceptable for v1)
- Mobile app
- Admin dashboard or content moderation tooling
- Personalized recommendations based on user profile

---

## 16. Success Criteria

- A user can type any common lifting topic and receive a structured, sourced response in under 5 seconds.
- The consensus classification is accurate and never presents contested topics as settled.
- All cited study links open in a new tab and point to a plausible source URL.
- The chat interface maintains context across at least 10 turns without degradation.
- The app renders correctly on Chrome, Firefox, and Safari at 375px and 1280px viewport widths.