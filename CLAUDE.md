# DriftWest — Project Notes for Claude Code

Static site for a West Coast drift event calendar (GitHub Pages). No build step —
plain HTML/CSS/JS, data lives in JSON files, content is hand-curated.

**Brand vs. repo name**: the site rebranded from "DriftCal" to "DriftWest" (name
collision with an unrelated existing driftcal.net, plus a scope broadening from
NorCal-only to West Coast). The GitHub repo itself is still named
`norcal-drift-calendar` and file names like `norcal_drift_calendar.ics` are
unchanged on purpose — renaming those would break calendar subscription links
people already added. Don't "fix" the repo/file names to match the brand unless
the user explicitly asks — it's intentional, not leftover cruft.

## Stack
- `index.html` / `style.css` / `script.js` — homepage (hero, events, calendar, track map)
- Hero logo is `.hero-logo`/`.wordmark` in `index.html` + `style.css` — an inline
  animated CSS wordmark (DRIFT/WEST + slowly drifting blurred smoke blobs), not an
  image file. There's no logo asset to replace if the brand changes again — just
  the text in the `.wordmark` element and the `assets/` folder has some pre-rebrand
  logo PNGs left over that are unused (`driftcal-logo_nb.png`, `logo.png`, etc.).
- `events.json` — event data (manually curated + scraper output from `scrapers/`).
  Optional `"featured": true` field overrides the homepage "JUST HAPPENED" card
  (`renderJustHappened()` in `script.js`), which otherwise auto-picks the most
  recent past event still inside its media submission window. Use it to correct
  the automatic pick when a more recent-but-less-notable event would otherwise
  win (e.g. a routine practice day happening a day after the event people are
  actually sharing media from).
- Every event carries an `addedAt` ISO timestamp, stamped once by `merge_events()`
  in `update_events.py` when the id is first seen and preserved on later updates
  (never touched again after that). `calendar_builder.py` uses the max `addedAt`
  across all events — not the max `start` date — to compute `status.json`'s
  `newestEvent`, since "newest" here means "most recently added to the site," not
  "happening furthest in the future." When hand-adding an event directly to
  `events.json`/`events.yaml` (bypassing the scrapers), set `addedAt` yourself to
  the current time so it still shows up correctly in the "LIVE EVENT FEED" strip.
- `calendar_builder.py`, `update_events.py` — generate `norcal_drift_calendar.ics` / `status.json`.
  `calendar_builder.py` fully rewrites `events.json` from `events.yaml` on every run
  using a hardcoded field whitelist (id/title/promoter/start/end/location/url/notes,
  plus `featured`/`addedAt` if present) — if you add a new optional field to events,
  it must be added to that whitelist too or it'll silently get dropped on the next
  automated run.
- Design language: black background, red accent (`#e10600`), bold italic headers,
  card grids with hover glow. See existing `.small-card` / `.event-card` patterns
  in `style.css` before adding new components — match the existing look.

## MEDIA tab
Goal: make the MEDIA tab a hub where photographers/videographers who shoot West Coast
drift events can share links to their albums/reels, organized **per event**, and
**per photographer within that event**. We are NOT hosting media files on the site
— just linking out to wherever the photographer already posted (Instagram, YouTube,
Google Drive, etc).

### Files added
- `media.json` — data file, one object per event:
  ```json
  { "eventId": "vdc-2026-07-11", "submissions": [
    { "name": "...", "role": "photo" | "video" | "both" | "driver", "url": "...", "note": "optional" }
  ]}
  ```
  `eventId` must match an id in `events.json`. This is the file the site owner
  edits by hand after approving a submission (see workflow below). `role: "driver"`
  is for drivers sharing their own clips who aren't dedicated photographers/
  videographers — rendered in its own "DRIVER CLIPS" section on `media.html`,
  separate from the "PHOTOGRAPHERS & VIDEOGRAPHERS" grid, via `renderMediaPage()`
  in `media.js` splitting `submissions` on `role === "driver"`.
- `media.html` — the "page per event" gallery, loaded as `media.html?event=<id>`.
  Reads `events.json` for event details + `media.json` for that event's submissions.
  Has a "SHOT THIS EVENT? SUBMIT YOUR LINK" banner linking to the Google Form (see below).
- `media.js` — shared logic: `renderMediaSection()` (homepage grid), `renderMediaPage()`
  (the per-event page), `formatDateParts()` (loaded before `script.js`, which also uses
  it), `platformLabel()` / `roleLabel()` helpers, and `mediaWindowOpen(event)` — returns
  true from 7 days before an event's start through 60 days after. Both the homepage
  grid and the calendar event modal (`openEventModal()` in `script.js`) use it to decide
  whether to show a "submit your link" call-to-action for events that don't have
  submissions yet, vs. the static "added after the event" placeholder for events outside
  that window. `script.js` keeps its own `allMedia` array (populated alongside
  `allEvents`) so the modal can look up submission counts without re-fetching.
- Homepage `#media` section (in `index.html`) lists events with existing galleries *and*
  events currently inside the submission window with no submissions yet (as a "be the
  first to submit" card) — links to `media.html?event=<id>` for each either way.
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
unless the user asks. The event dropdown doesn't need a rigid format — the script
fuzzy-matches an answer to an `eventId` if it contains both that event's date and its
title/promoter somewhere in the text (see `automation/media-submission/README.md` §5).
Still needs a new dropdown option whenever a new event is added, just not a specific
syntax.

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
