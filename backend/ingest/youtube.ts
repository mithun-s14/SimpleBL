// YouTube Data API v3: discover the channel's videos.
//
// Deliberately the official API rather than page scraping -- it is stable, and
// at 1 quota unit per playlist page a daily incremental run is nowhere near the
// 10,000/day default.

import type { TranscriptStatus } from '../src/keenan/types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface DiscoveredVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  transcriptStatus: TranscriptStatus;
}

async function apiGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set');

  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${endpoint} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function getUploadsPlaylistId(channelId: string): Promise<string> {
  const data = await apiGet('channels', { part: 'contentDetails', id: channelId });
  const playlistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error(`No uploads playlist for channel ${channelId}`);
  return playlistId;
}

// ISO 8601 duration ("PT1H2M3S") -> seconds.
export function parseDuration(iso: string): number {
  const m = /^P(?:([\d.]+)D)?T?(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    (parseFloat(d || '0') * 86400) +
    (parseFloat(h || '0') * 3600) +
    (parseFloat(min || '0') * 60) +
    parseFloat(s || '0')
  );
}

async function fetchDurations(videoIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await apiGet('videos', { part: 'contentDetails', id: batch.join(',') });
    for (const item of data.items ?? []) {
      out.set(item.id, parseDuration(item.contentDetails?.duration ?? ''));
    }
  }
  return out;
}

// Walks the uploads playlist newest-first. When `stopAtKnown` is supplied, the
// walk halts on the first already-stored video -- the incremental path. Pass an
// empty set to force a full backfill.
export async function discoverVideos(
  channelId: string,
  stopAtKnown: Set<string> | null,
  onPage?: (count: number) => void
): Promise<DiscoveredVideo[]> {
  const playlistId = await getUploadsPlaylistId(channelId);
  const found: Array<Omit<DiscoveredVideo, 'durationSeconds'>> = [];
  let pageToken: string | undefined;
  let halted = false;

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await apiGet('playlistItems', params);

    for (const item of data.items ?? []) {
      const videoId: string | undefined = item.contentDetails?.videoId;
      if (!videoId) continue;

      if (stopAtKnown && stopAtKnown.has(videoId)) {
        halted = true;
        break;
      }

      found.push({
        videoId,
        title: item.snippet?.title ?? '(untitled)',
        // contentDetails.videoPublishedAt is the video's own date; the snippet
        // date is when it was added to the playlist. They usually match, but
        // not for re-added videos.
        publishedAt:
          item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? new Date().toISOString(),
        transcriptStatus: 'failed' as TranscriptStatus, // pending until captions are fetched
      });
    }

    onPage?.(found.length);
    pageToken = halted ? undefined : data.nextPageToken;
  } while (pageToken);

  const durations = await fetchDurations(found.map((v) => v.videoId));
  return found.map((v) => ({ ...v, durationSeconds: durations.get(v.videoId) ?? 0 }));
}
