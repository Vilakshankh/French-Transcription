# French Transcription

A small Next.js site that plays a YouTube video and shows its transcript beside it, highlighting
and scrolling to the current line as the video plays. Click any line to jump the video there.

It starts on [ejVkyXSl63I](https://www.youtube.com/watch?v=ejVkyXSl63I); paste any other YouTube URL
into the box at the top to switch, or open `/?v=<video id>`.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build && npm start`. The app also deploys to Vercel with no extra config.

## How it works

- `components/YouTubePlayer.tsx` wraps the YouTube IFrame Player API.
- `components/TranscriptPlayer.tsx` polls the player's current time while it plays and picks the
  matching cue; `components/TranscriptPanel.tsx` renders the cues, auto-scrolls, and seeks on click.
- `app/api/transcript/route.ts` (`GET /api/transcript?v=<id>&lang=<code>`) fetches the caption
  track list from YouTube on the server (browsers can't call YouTube's caption endpoints directly),
  prefers a human-made French track, then auto-generated French, then English, then whatever exists,
  and returns `{ start, dur, text }` cues. Results are cached in memory for an hour.
- `lib/transcript.ts` holds the fetcher and XML parser; `lib/youtube.ts` holds shared helpers.

Change `DEFAULT_VIDEO_ID` in `lib/youtube.ts` to pick a different starting video, and
`DEFAULT_LANGUAGES` in `lib/transcript.ts` to change language preference.

## Limitations

Transcripts come from YouTube's own captions, so a video with captions disabled has no transcript.
YouTube occasionally rate-limits or blocks caption requests from cloud IPs; the API returns a clear
error message when that happens.
