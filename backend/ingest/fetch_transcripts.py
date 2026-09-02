"""Fetch YouTube captions for a list of video IDs.

This is the one place the project crosses the language line, and it is
deliberate: YouTube now requires a PO token for direct `timedtext` requests, so
the Node clients (youtubei.js, youtube-transcript) come back empty.
`youtube-transcript-api` still works and is the most battle-tested option.

It is a leaf node -- it reads video IDs on stdin, writes JSON Lines to stdout,
and touches nothing else. All storage stays in TypeScript (see ingest/db.ts).

Usage:
    echo '["dQw4w9WgXcQ"]' | python3 fetch_transcripts.py

Each output line:
    {"videoId": str, "status": "ok"|"no_captions"|"failed",
     "segments": [{"text": str, "start": float, "duration": float}],
     "error": str | None}
"""

import json
import random
import sys
import time

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

# YouTube rate-limits this endpoint hard. Sleep between videos, and back off
# exponentially on failure rather than hammering.
BASE_SLEEP_SECONDS = 1.5
MAX_ATTEMPTS = 4


def fetch_one(api, video_id):
    """Return (status, segments, error). Distinguishes permanent from transient
    failures: `no_captions` is never retried by later runs, `failed` is."""
    for attempt in range(MAX_ATTEMPTS):
        try:
            transcripts = api.list(video_id)
            try:
                # Manually written captions beat auto-generated ones when both exist.
                transcript = transcripts.find_manually_created_transcript(["en"])
            except NoTranscriptFound:
                transcript = transcripts.find_generated_transcript(["en"])

            segments = [
                {"text": s.text, "start": s.start, "duration": s.duration}
                for s in transcript.fetch()
            ]
            return "ok", segments, None

        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as exc:
            # Permanent for this video -- no amount of retrying changes it.
            return "no_captions", [], type(exc).__name__

        except Exception as exc:  # noqa: BLE001 - transient: network, 429, parser drift
            if attempt == MAX_ATTEMPTS - 1:
                return "failed", [], f"{type(exc).__name__}: {exc}"[:300]
            backoff = (2 ** attempt) * BASE_SLEEP_SECONDS + random.uniform(0, 1)
            print(
                f"  retry {video_id} in {backoff:.1f}s ({type(exc).__name__})",
                file=sys.stderr,
            )
            time.sleep(backoff)

    return "failed", [], "exhausted retries"


def main():
    video_ids = json.load(sys.stdin)
    api = YouTubeTranscriptApi()

    for i, video_id in enumerate(video_ids):
        if i > 0:
            time.sleep(BASE_SLEEP_SECONDS + random.uniform(0, 0.5))

        status, segments, error = fetch_one(api, video_id)
        print(
            json.dumps(
                {
                    "videoId": video_id,
                    "status": status,
                    "segments": segments,
                    "error": error,
                }
            ),
            flush=True,
        )


if __name__ == "__main__":
    main()
