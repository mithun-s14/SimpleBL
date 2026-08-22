const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TOOL_PARAMS = 'tool=simplebl&email=contact@simplebl.app';
const MAX_FULL_TEXT_CHARS = 12000;

// Decode common XML entities and strip tags (mirrors pubmed.ts)
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
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

// Find a linked PMC ID for a given PMID, if the article has one — never throws
export async function resolvePmcId(pmid: string): Promise<string | null> {
  try {
    const url = `${EUTILS}/elink.fcgi?dbfrom=pubmed&db=pmc&id=${encodeURIComponent(pmid)}&retmode=json&${TOOL_PARAMS}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      linksets?: Array<{ linksetdbs?: Array<{ links?: string[] }> }>;
    };
    const links = data.linksets?.[0]?.linksetdbs?.[0]?.links;
    return links && links.length > 0 ? links[0] : null;
  } catch (err) {
    console.warn('[pmc] resolvePmcId failed:', err);
    return null;
  }
}

// Fetch open-access full text body for a PMC ID as plain text — never throws
export async function fetchPmcFullText(pmcId: string): Promise<string | null> {
  try {
    const url = `${EUTILS}/efetch.fcgi?db=pmc&id=${encodeURIComponent(pmcId)}&rettype=full&retmode=xml&${TOOL_PARAMS}`;
    const res = await fetchWithTimeout(url, 12000);
    if (!res.ok) return null;
    const xml = await res.text();

    const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    if (!bodyMatch) return null;

    const text = decodeEntities(bodyMatch[1]);
    if (!text || text.length < 200) return null;

    return text.length > MAX_FULL_TEXT_CHARS
      ? `${text.slice(0, MAX_FULL_TEXT_CHARS)}\n\n[... full text truncated for length ...]`
      : text;
  } catch (err) {
    console.warn('[pmc] fetchPmcFullText failed:', err);
    return null;
  }
}
