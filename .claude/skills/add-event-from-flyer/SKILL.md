---
name: add-event-from-flyer
description: Add drift events to this site's calendar (events.yaml/events.json) from a photo of a promoter's schedule flyer or Instagram graphic, instead of a live website. Use this whenever the user shares/pastes an image of an event schedule, poster, or flyer and wants the date(s) added to the calendar - especially for GoodLuckLeague (GLL) and Valley Drift Club (VDC), who only ever publish their schedules as Instagram images with no real website to scrape. Also applies to any other promoter's flyer image, one-off event poster, or screenshot of a schedule graphic.
---

# Add Event From Flyer

Promoters like GoodLuckLeague and Valley Drift Club don't run a website with a
schedule page - they post a graphic to Instagram a few times a year with the
whole season's dates on it. There's no feed or page to scrape, so the only way
to catch these is to read the flyer image when the user shares it and add the
events by hand. This skill is that process, made repeatable so it comes out
the same way every time.

## Step 1: Read the flyer carefully

Extract, for each event on the flyer:
- **Title** - the event name as printed. If a slot just shows "???" or is
  otherwise unnamed, don't invent a title - ask the user what to call it.
- **Date(s)** - flyers are often "2nd half schedule" or similar, listing
  several dates under one promoter/venue header.
- **Location/venue** - if the flyer doesn't repeat it per-event, it usually
  applies to every date shown.
- **Hours**, if printed. If not printed, default to `08:00`-`17:00` (8AM-5PM)
  - every event added to this site so far uses this default when the flyer
  doesn't specify.

## Step 2: Apply promoter conventions

Known promoters already have an established pattern in `events.yaml` - grep
for their existing entries first (`grep -A8 "promoter: X" events.yaml`) and
match whatever you find. As of now:

| Promoter | id prefix | `promoter` field | Default location | Default registration link |
|---|---|---|---|---|
| GoodLuckLeague | `gll-` | `GoodLuckLeague` (shows as "GLL" via `PROMOTER_ABBREV` in script.js) | Thunderhill Raceway Park | `https://www.goodluckleague.com/schedule` |
| Valley Drift Club | `vdc-` | `Valley Drift Club` (shows as "VDC") | NASA Crows Landing Airport | `https://www.valleydriftclub.com/` |

For a promoter not in that table (or not yet in `events.yaml` at all), pick a
short lowercase prefix from their name (e.g. "Cursed Chassis" -> `cc-`), check
it doesn't collide with an existing prefix (`grep "^- id: <prefix>-"`), and
confirm the choice with the user if it's not obvious.

**Registration link**: if the flyer doesn't show one and the promoter's known
default (table above) doesn't clearly apply to this specific event, ask the
user for the link rather than guessing one - a wrong or missing registration
link is worse than asking.

## Step 3: Check for duplicates

Before adding anything, check whether `<prefix>-YYYY-MM-DD` already exists in
`events.yaml` for each date on the flyer. Flyers get reposted/reshared, and
the user may have already sent you this exact schedule before. If a date's
already there, skip it (or flag the difference if some detail changed) rather
than creating a duplicate id.

## Step 4: Add the entries

Update **both** `events.yaml` and `events.json` for every new event - the
site reads `events.json` directly, but `events.yaml` is the source of truth
that the daily automation regenerates `events.json` from, so they must stay
in sync. Read a few neighboring entries in each file first and match the
exact field order:

- `events.yaml`: `id`, `addedAt`, `title`, `promoter`, `start`, `end`,
  `location`, `url`, `notes`
- `events.json`: same fields, but `addedAt` last

Use `notes: Manually added by the site owner.` unless there's something more
specific worth noting (invite-only, multi-day, etc.).

File order doesn't matter - the site sorts events by date client-side - so
appending new entries to the end of each file is fine and faster than finding
the chronologically "correct" insertion point.

**`addedAt` must be distinct per event.** Give each new event its own
timestamp a few minutes apart from the others you're adding in this batch
(e.g. `2026-08-01T00:00:00Z`, `:05:00Z`, `:10:00Z`...). The homepage's "newest
event" display picks whichever event has the latest `addedAt`, and if several
events share an identical timestamp it just falls back to list order - which
silently breaks the "show what was just added" feature. This has bitten this
project before; don't repeat it.

## Step 5: Validate

- Confirm `events.json` still parses: a JSON syntax slip here breaks the live
  site.
- Confirm entry counts match: `grep -c "^- id:" events.yaml` should equal
  `grep -c '"id":' events.json`.

## Step 6: Commit and push

This repo pushes straight to `main` (no feature branches) - but a daily
GitHub Action also commits to `main` on its own schedule, so:
1. `git pull --ff-only origin main` before you start editing.
2. Right before pushing, `git fetch origin` and check
   `git log --oneline main..origin/main` - if it's non-empty, `git pull --rebase`
   first (the daily automation only ever touches `norcal_drift_calendar.ics`
   and `status.json`, so this is normally a clean rebase, not a real conflict).
3. Commit with a message naming the promoter and dates added, then push.

Confirm with the user before pushing, same as any other change to this repo.

## Step 7: Give pastable Google Form lines

For every event you added, include a line in this exact format so the user
can paste it straight into the media-submission Google Form's event dropdown:

```
{Title} - {Month} {Day}, {Year}
```

Do this automatically without being asked - it's a standing preference for
every event added to this site, not just ones that come from a flyer.
