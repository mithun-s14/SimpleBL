// Video discovery without a YouTube Data API key.
//
// The Data API (ingest/youtube.ts) is the primary path and stays the
// recommendation -- it is stable and documented. This fallback exists so the
// feature is runnable before anyone provisions a key: youtubei.js reads the
// channel's video tab the way the site itself does.
//
// It is scraping by another name, so it is more fragile than the Data API and
// gives no quota guarantees. Set YOUTUBE_API_KEY to leave this path behind.

import type { DiscoveredVideo } from './youtube';
import type { TranscriptStatus } from '../src/keenan/types';

// youtubei.js v18 is ESM-only and the backend compiles to CommonJS, which
// Node 20.17 cannot `require()`. Building the import through Function keeps it
// a real dynamic import instead of being downleveled by tsc.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

async function createClient(): Promise<any> {
  const mod = await dynamicImport('youtubei.js');
  const Innertube = mod.Innertube ?? mod.default?.Innertube ?? mod.default;
  return Innertube.create({ retrieve_player: false });
}

// Resolves a channel handle (@Keenanrmalloy) or a full URL to a UC... channel ID.
export async function resolveChannelId(handleOrUrl: string): Promise<string> {
  if (/^UC[\w-]{22}$/.test(handleOrUrl)) return handleOrUrl;

  const tube = await createClient();
  const url = handleOrUrl.startsWith('http')
    ? handleOrUrl
    : `https://www.youtube.com/${handleOrUrl.startsWith('@') ? '' : '@'}${handleOrUrl}`;

  const resolved = await tube.resolveURL(url);
  const channelId = resolved?.payload?.browseId;
  if (!channelId) throw new Error(`Could not resolve a channel ID from ${handleOrUrl}`);
  return channelId;
}

function parseDurationText(text: string | undefined): number {
  if (!text) return 0;
  // "1:03:12" or "9:41"
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, part) => acc * 60 + part, 0);
}

// "3 days ago" / "Sep 1, 2026" -> ISO date. The channel listing only gives
// relative dates, so this is approximate; the Data API path gives exact ones.
function parsePublished(text: string | undefined): string {
  if (!text) return new Date().toISOString();

  const relative = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(text.trim());
  if (relative) {
    const amount = parseInt(relative[1], 10);
    const unitSeconds: Record<string, number> = {
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86400,
      week: 604800,
      month: 2629800,
      year: 31557600,
    };
    const seconds = amount * unitSeconds[relative[2].toLowerCase()];
    return new Date(Date.now() - seconds * 1000).toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function discoverVideosFallback(
  channelId: string,
  stopAtKnown: Set<string> | null,
  onPage?: (count: number) => void
): Promise<DiscoveredVideo[]> {
  const tube = await createClient();
  const channel = await tube.getChannel(channelId);

  let feed = await channel.getVideos();
  const found: DiscoveredVideo[] = [];
  let halted = false;

  while (feed && !halted) {
    for (const video of feed.videos ?? []) {
      const videoId: string | undefined = video.content_id ?? video.id ?? video.video_id;
      if (!videoId) continue;

      if (stopAtKnown && stopAtKnown.has(videoId)) {
        halted = true;
        break;
      }

      const meta = readMetadata(video);
      found.push({
        videoId,
        title: meta.title || '(untitled)',
        publishedAt: parsePublished(meta.published),
        durationSeconds: parseDurationText(meta.duration),
        transcriptStatus: 'failed' as TranscriptStatus, // pending until captions land
      });
    }

    onPage?.(found.length);
    if (halted || !feed.has_continuation) break;
    feed = await feed.getContinuation();
  }

  return found;
}

// Field paths confirmed against youtubei.js 18 on the target channel:
//   metadata.title.text                        -> "WHY EXERCISE SELECTION MATTERS"
//   content_image.overlays[0].badges[0].text   -> "1:03:33"
//   metadata.metadata.metadata_rows[].parts[]  -> ["5.3K views", "17 hours ago"]
// Read defensively anyway -- these are internal renderer shapes, not an API.
function readMetadata(video: any): { title: string; duration?: string; published?: string } {
  const title: string = video.metadata?.title?.text ?? video.title?.text ?? '';

  const duration: string | undefined =
    video.content_image?.overlays
      ?.flatMap((overlay: any) => overlay?.badges ?? [])
      ?.map((badge: any) => badge?.text)
      ?.find((t: unknown) => typeof t === 'string' && /^\d+(:\d{2})+$/.test(t as string)) ??
    video.duration?.text;

  const texts: string[] = (video.metadata?.metadata?.metadata_rows ?? [])
    .flatMap((row: any) => row?.metadata_parts ?? [])
    .map((part: any) => part?.text?.text)
    .filter((t: unknown): t is string => typeof t === 'string');

  // "17 hours ago" / "Sep 1, 2026" -- the views count sits in the same row.
  const published: string | undefined =
    video.published?.text ?? texts.find((t) => /ago$/i.test(t) || /^\w+ \d+, \d{4}$/.test(t));

  return { title, duration, published };
}
