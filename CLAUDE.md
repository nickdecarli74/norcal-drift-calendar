# DriftCal — Project Notes for Claude Code

Static site for a NorCal drift event calendar (GitHub Pages). No build step —
plain HTML/CSS/JS, data lives in JSON files, content is hand-curated.

## Stack
- `index.html` / `style.css` / `script.js` — homepage (hero, events, calendar, track map)
- `events.json` — event data (manually curated + scraper output from `scrapers/`)
- `calendar_builder.py`, `update_events.py` — generate `norcal_drift_calendar.ics` / `status.json`
- Design language: black background, red accent (`#e10600`), bold italic headers,
  card grids with hover glow. See existing `.small-card` / `.event-card` patterns
  in `style.css` before adding new components — match the existing look.

## Current branch: `media-tab-feature`
Do not merge into `main` without the user's review — `main` is the live site.

## What we're building: MEDIA tab
Goal: make the MEDIA tab a hub where photographers/videographers who shoot NorCal
drift events can share links to their albums/reels, organized **per event**, and
**per photographer within that event**. We are NOT hosting media files on the site
— just linking out to wherever the photographer already posted (Instagram, YouTube,
Google Drive, etc).

### Files added
- `media.json` — data file, one object per event:
  ```json
  { "eventId": "vdc-2026-07-11", "submissions": [
    { "name": "...", "role": "photo" | "video", "url": "...", "note": "optional" }
  ]}
  ```
  `eventId` must match an id in `events.json`. This is the file the site owner
  edits by hand after approving a submission (see workflow below).
- `media.html` — the "page per event" gallery, loaded as `media.html?event=<id>`.
  Reads `events.json` for event details + `media.json` for that event's submissions.
  Has a "SHOT THIS EVENT? SUBMIT YOUR LINK" banner linking to the Google Form (see below).
- `media.js` — shared logic: `renderMediaSection()` (homepage grid of events-with-media,
  called from `script.js`) and `renderMediaPage()` (the per-event page). Also has
  `formatDateParts()` (moved here from `script.js`, loaded before it) and
  `platformLabel()` / `roleLabel()` helpers.
- Homepage `#media` section (in `index.html`) lists events with galleries, links to
  `media.html?event=<id>` for each.

### Submission workflow (decided, already built)
Self-serve, not fully automated — the site owner manually approves before anything
goes live:
1. Photographer fills out a Google Form (already created, live):
   https://docs.google.com/forms/d/e/1FAIpQLSfgvWh9QZlCBY46bMQCUbZy4DMaewADwCGHScMELIs4Wby_Rg/viewform
   Fields: Name/Handle, Event (dropdown), Role (photo/video/both), Link, Contact, Notes.
2. Responses land in a linked Google Sheet.
3. Owner reviews, copies approved entries into `media.json` by hand, pushes.
4. This mirrors the existing manual-curation pattern already used for VDC events
   in `events.json` — no new infra, no backend/database added.

This form link is placeholder-free and real — do not swap it back to a mailto
unless the user asks.

### Seeded/placeholder data
`media.json` currently has **placeholder entries** for the first event
(`vdc-2026-07-11`, the Valley Drift Club event on July 11, 2026) — fake names/links
so the layout is visible. Replace with real submissions once the user approves them
from the Google Form responses. Don't invent real photographer names.

### Not yet decided / open for later
- No real backend for auto-publishing approved submissions (Option 3 from earlier
  discussion — a proper approve/reject queue) — deliberately deferred. Only build
  this if the user asks; don't add infra unprompted.
- No file/photo hosting on-site — links out only, by design.

## Working agreement
- Match existing code style (vanilla JS, no frameworks, no build tools).
- Don't push to `main` directly — work on branches, let the user review/merge.
- When adding new events to `media.json`, cross-check `eventId` exists in `events.json`.
