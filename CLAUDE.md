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

## MEDIA tab
Goal: make the MEDIA tab a hub where photographers/videographers who shoot NorCal
drift events can share links to their albums/reels, organized **per event**, and
**per photographer within that event**. We are NOT hosting media files on the site
— just linking out to wherever the photographer already posted (Instagram, YouTube,
Google Drive, etc).

### Files added
- `media.json` — data file, one object per event:
  ```json
  { "eventId": "vdc-2026-07-11", "submissions": [
    { "name": "...", "role": "photo" | "video" | "both", "url": "...", "note": "optional" }
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
- `automation/media-submission/Code.gs` — Google Apps Script, bound to the form's
  response Sheet, triggered on form submit. Resolves the submitted event to an
  `eventId`, opens a GitHub PR adding the submission to `media.json`, and emails the
  owner a summary (contact info goes in the email only, never the PR — repo is
  public). See `automation/media-submission/README.md` for one-time setup (Apps
  Script trigger, GitHub PAT in Script Properties) — Claude Code can't do that setup
  itself, it needs the owner's Google/GitHub accounts.

### Submission workflow (decided, already built)
Self-serve, review-gated via GitHub PR — the site owner still approves everything,
they just merge a PR instead of hand-editing JSON:
1. Photographer fills out a Google Form (already created, live):
   https://docs.google.com/forms/d/e/1FAIpQLSfgvWh9QZlCBY46bMQCUbZy4DMaewADwCGHScMELIs4Wby_Rg/viewform
   Fields: Name/Handle, Event (dropdown), Role (photo/video/both), Link, Contact, Notes.
2. Responses land in a linked Google Sheet, which fires the Apps Script trigger
   (`automation/media-submission/Code.gs`).
3. The script opens a PR adding the submission to `media.json` and emails the owner
   the details (including Contact, which is deliberately excluded from the public PR).
4. Owner reviews the PR on GitHub and merges (or closes it) — that's the approval step.
5. Fallback: if the automation is down, or the event dropdown's label doesn't match
   `events.json` (the script emails a failure alert with the raw submission in that
   case), the owner can still copy entries into `media.json` by hand and push, exactly
   as before.

This form link is placeholder-free and real — do not swap it back to a mailto
unless the user asks. The event dropdown's option text must exactly match
`<title> — <promoter> — <date>` (see `automation/media-submission/README.md` §5) so
the script can resolve it — update the dropdown when adding new events.

### Seeded/placeholder data
`media.json` currently has **placeholder entries** for the first event
(`vdc-2026-07-11`, the Valley Drift Club event on July 11, 2026) — fake names/links
so the layout is visible. Replace with real submissions once the user approves them
from the Google Form responses. Don't invent real photographer names.

### Not yet decided / open for later
- No file/photo hosting on-site — links out only, by design.
- The Apps Script role mapping (`mapRole_` in `Code.gs`) guesses "photo" for
  unrecognized Role answers rather than dropping the submission — revisit if the
  form's Role options ever change wording.

## Working agreement
- Match existing code style (vanilla JS, no frameworks, no build tools).
- This repo pushes directly to `main` (no long-lived feature branches) — `main` is
  the live site, so still confirm before pushing, but branch-per-feature isn't the
  pattern here.
- When adding new events to `media.json`, cross-check `eventId` exists in `events.json`.
- `norcal_drift_calendar.ics`, `events.json`, `status.json`, `events.yaml` are
  auto-generated by `.github/workflows/update.yml` (daily cron, runs
  `update_events.py` + `calendar_builder.py`) — don't hand-edit them, and prefer
  origin's version of these files if a merge conflict ever comes up.
