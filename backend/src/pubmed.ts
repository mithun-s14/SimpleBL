const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TOOL_PARAMS = 'tool=simplebl&email=contact@simplebl.app';

export interface PubMedAbstract {
  pmid: string;
  title: string;
  authors: string;
  year: string;
  abstract: string;
}

const STOP_WORDS = new Set([
  'how', 'many', 'much', 'should', 'i', 'a', 'an', 'the', 'is', 'are', 'was',
  'were', 'what', 'when', 'where', 'why', 'which', 'who', 'do', 'does', 'did',
  'can', 'could', 'would', 'will', 'to', 'for', 'in', 'on', 'at', 'by', 'with',
  'from', 'my', 'your', 'their', 'its', 'of', 'and', 'or', 'but', 'not', 'be',
  'been', 'being', 'have', 'has', 'had', 'it', 'this', 'that', 'these', 'those',
  'if', 'then', 'than', 'so', 'as', 'up', 'out', 'about', 'into', 'per',
  'get', 'make', 'need', 'want', 'use', 'know', 'think', 'try', 'me', 'we',
]);

// Strip conversational language down to PubMed-friendly keywords
function extractKeywords(query: string): string {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return words.slice(0, 7).join(' ');
}

// Narrow to fitness science — no study-type filter so conversational queries still match
function enhanceQuery(query: string): string {
  const keywords = extractKeywords(query);
  const domain =
    '(exercise OR "resistance training" OR "strength training" OR "muscle hypertrophy" OR nutrition OR supplementation OR recovery OR athlete)';
  return `${keywords} AND ${domain}`;
}

// Decode common XML entities
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')  // strip any remaining tags
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(url: string, retries = 1, delayMs = 400): Promise<Response> {
  try {
    return await fetchWithTimeout(url);
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return fetchWithRetry(url, retries - 1, delayMs * 2);
  }
}

async function esearch(query: string): Promise<string[]> {
  const term = encodeURIComponent(enhanceQuery(query));
  const url = `${EUTILS}/esearch.fcgi?db=pubmed&term=${term}&retmax=8&retmode=json&sort=relevance&${TOOL_PARAMS}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`esearch ${res.status}`);
  const data = (await res.json()) as { esearchresult: { idlist: string[] } };
  return data.esearchresult.idlist ?? [];
}

async function efetch(pmids: string[]): Promise<PubMedAbstract[]> {
  const url = `${EUTILS}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&rettype=abstract&retmode=xml&${TOOL_PARAMS}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`efetch ${res.status}`);
  const xml = await res.text();

  // Split by article boundary so we process each paper independently
  const articles = xml.split(/<PubmedArticle[\s>]/);
  const results: PubMedAbstract[] = [];

  for (const article of articles.slice(1)) {
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];

    const titleMatch = article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : 'Untitled';

    const lastNameMatch = article.match(/<LastName>([^<]+)<\/LastName>/);
    const authors = lastNameMatch ? `${lastNameMatch[1]} et al.` : 'Unknown authors';

    const yearMatch = article.match(/<Year>(\d{4})<\/Year>/);
    const year = yearMatch ? yearMatch[1] : '';

    // Structured abstracts have multiple <AbstractText> elements; join them
    const abstractParts: string[] = [];
    const abstractRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let m: RegExpExecArray | null;
    while ((m = abstractRegex.exec(article)) !== null) {
      abstractParts.push(decodeEntities(m[1]));
    }
    const abstract = abstractParts.join(' ');

    if (abstract) {
      results.push({ pmid, title, authors, year, abstract });
    }
  }

  return results;
}

export function buildContextBlock(abstracts: PubMedAbstract[]): string {
  if (abstracts.length === 0) return '';

  const entries = abstracts
    .map(
      (a, i) =>
        `[${i + 1}] PMID: ${a.pmid}
Title: ${a.title}
Authors: ${a.authors}${a.year ? ` (${a.year})` : ''}
URL: https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/
Abstract: ${a.abstract}`
    )
    .join('\n\n');

  return `=== RETRIEVED PUBMED LITERATURE ===\n\n${entries}\n\n=== END OF RETRIEVED LITERATURE ===`;
}

// Top-level function — never throws. Returns [] on any failure.
export async function fetchPubMedAbstracts(query: string): Promise<PubMedAbstract[]> {
  console.log(`[pubmed] searching for: "${query.slice(0, 80)}"`);
  try {
    const pmids = await esearch(query);
    console.log(`[pubmed] esearch returned ${pmids.length} PMIDs:`, pmids);
    if (pmids.length === 0) return [];

    // Respect NCBI's 3 req/sec limit between the two calls
    await new Promise((r) => setTimeout(r, 340));

    const abstracts = await efetch(pmids);
    console.log(`[pubmed] retrieved ${abstracts.length} abstracts`);
    return abstracts;
  } catch (err) {
    console.warn('[pubmed] fetch failed, proceeding without context:', err);
    return [];
  }
}
