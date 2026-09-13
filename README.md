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
- `components/TranscriptPlayer.tsx` polls the player's current time while it plays and passes it to
  `components/TranscriptPanel.tsx`, which groups the captions by minute (each minute starts a new
  paragraph with a clickable time mark), streams the words of the line being spoken with
  `components/streaming-text.tsx`, keeps the current line in view, and seeks the video when you click
  a line or a time mark. The "Stream" switch shows the full transcript instead, with the current
  line highlighted.
- `app/api/transcript/route.ts` (`GET /api/transcript?v=<id>&lang=<code>`) fetches the caption
  track list from YouTube on the server (browsers can't call YouTube's caption endpoints directly),
  prefers a human-made French track, then auto-generated French, then English, then whatever exists,
  and returns `{ start, dur, text }` cues. Results are cached in memory for an hour.
- `lib/transcript.ts` holds the fetcher and XML parser; `lib/youtube.ts` holds shared helpers.

## UI

The UI is built with [shadcn/ui](https://ui.shadcn.com) on Base UI, using the `b4gMUX5Fo` preset
(Nova style, neutral palette, red charts, Inter, Lucide icons, small radius). `components.json`
carries that configuration, so `npx shadcn@latest add <component>` drops new components into
`components/ui` in the same style. Light and dark mode are handled by `next-themes`; use the toggle
in the header or press `d`.

Change `DEFAULT_VIDEO_ID` in `lib/youtube.ts` to pick a different starting video, and
`DEFAULT_LANGUAGES` in `lib/transcript.ts` to change language preference.

## Limitations

Transcripts come from YouTube's own captions, so a video with captions disabled has no transcript.
YouTube occasionally rate-limits or blocks caption requests from cloud IPs; the API returns a clear
error message when that happens.
