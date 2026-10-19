#!/usr/bin/env python3
"""Generate static per-event pages (events/<id>/index.html) with schema.org
Event JSON-LD, plus sitemap.xml.

Called at the end of calendar_builder.py so the pages stay in sync with
events.yaml on every build (including the daily GitHub Actions run).

Each multi-day event gets ONE canonical page (grouped exactly like
groupMultiDayEvents() in media.js; the group's id is the first day's id).
Non-first-day ids get a tiny redirect page so old per-day links keep working.

The pages reuse the existing style.css classes (photog-card, submit-banner,
modal-*, etc.) so no stylesheet changes are needed.
"""

import html
import json
import os
import re
import shutil
from datetime import date, datetime, timedelta
from urllib.parse import urlparse

SITE = "https://driftwest.net"
EVENTS_DIR = "events"
OG_IMAGE = "https://driftwest.net/assets/driftwest-3d-opengraph.jpg"

SITE_DESCRIPTION = (
    "DriftWest is the West Coast drift calendar and media hub. "
    "Find every event, see who shot it, and get your photos and videos "
    "linked with full credit."
)


# ---------------------------------------------------------------------------
# Ports of the JS helpers in media.js (keep behavior identical)
# ---------------------------------------------------------------------------

def base_event_title(title):
    return re.sub(r"\s*[-\u2013]\s*Day\s*\d+\s*$", "", title or "", flags=re.I).strip()


def days_between(a_str, b_str):
    da = datetime.strptime(a_str[:10], "%Y-%m-%d").date()
    db = datetime.strptime(b_str[:10], "%Y-%m-%d").date()
    return (db - da).days


def end_date_key(start_str, end_str):
    if not end_str:
        return start_str[:10]
    end_key = end_str[:10]
    if end_str[11:16] != "00:00" or end_key <= start_str[:10]:
        return end_key
    d = datetime.strptime(end_key, "%Y-%m-%d").date() - timedelta(days=1)
    return d.isoformat()


def group_multi_day(events):
    events = sorted(events, key=lambda e: e["start"])
    groups = []
    latest = {}
    for e in events:
        end = e.get("end") or e["start"]
        key = (
            e.get("promoter", ""),
            base_event_title(e["title"]).lower(),
            e.get("location", ""),
        )
        g = latest.get(key)
        if g and days_between(g["end"], e["start"]) <= 1:
            g["days"].append(e)
            if end > g["end"]:
                g["end"] = end
            g["url"] = g["url"] or e.get("url", "")
            g["title"] = base_event_title(g["title"])
            for f in ("featured", "featuredNext", "featuredPartner"):
                if e.get(f):
                    g[f] = True
        else:
            grp = dict(e)
            grp["end"] = end
            grp["days"] = [e]
            groups.append(grp)
            latest[key] = grp
    return groups


_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def format_date_full(start_str, end_str):
    """Mirror formatDateParts().full from media.js."""
    d = datetime.strptime(start_str[:16], "%Y-%m-%d %H:%M")
    end_key = end_date_key(start_str, end_str) if end_str else start_str[:10]
    same_day = not end_str or start_str[:10] == end_key
    if same_day:
        return f"{_MONTHS[d.month-1]} {d.day}, {d.year}"
    e = datetime.strptime(end_key, "%Y-%m-%d").date()
    if d.month == e.month and d.year == e.year:
        return f"{_MONTHS[d.month-1]} {d.day}\u2013{e.day}, {e.year}"
    if d.year == e.year:
        return f"{_MONTHS[d.month-1]} {d.day} \u2013 {_MONTHS[e.month-1]} {e.day}, {e.year}"
    return (f"{_MONTHS[d.month-1]} {d.day}, {d.year} \u2013 "
            f"{_MONTHS[e.month-1]} {e.day}, {e.year}")


def platform_label(url):
    try:
        host = urlparse(url).hostname or ""
        host = host.replace("www.", "")
        if "instagram" in host:
            return "Instagram"
        if "youtube" in host or "youtu.be" in host:
            return "YouTube"
        if "drive.google" in host:
            return "Google Drive"
        if "photos.google" in host or "photos.app.goo.gl" in host:
            return "Google Photos"
        if "dropbox" in host:
            return "Dropbox"
        if "vimeo" in host:
            return "Vimeo"
        if "tiktok" in host:
            return "TikTok"
        if "smugmug" in host:
            return "SmugMug"
        if "flickr" in host:
            return "Flickr"
        return host or "Link"
    except Exception:
        return "Link"


def role_label(role):
    return {
        "video": "\U0001F3A5 Videographer",
        "photo": "\U0001F4F7 Photographer",
        "both": "\U0001F4F8 Photographer & Videographer",
        "driver": "\U0001F697 Driver Clip",
    }.get(role, "\U0001F4F8 Media")


def instagram_profile_handle_from_url(url):
    try:
        u = urlparse(url)
        if "instagram" not in (u.hostname or "").replace("www.", ""):
            return None
        parts = [p for p in u.path.split("/") if p]
        if not parts:
            return None
        if parts[0].lower() in ("p", "reel", "reels", "stories", "tv", "explore"):
            return None
        return parts[0].lower()
    except Exception:
        return None


def instagram_handle_for(sub):
    handle = None
    if sub.get("instagram"):
        handle = sub["instagram"].strip().lstrip("@")
    else:
        m = re.search(r"@([a-zA-Z0-9_.]{2,30})", sub.get("name", ""))
        if m:
            handle = m.group(1)
        else:
            trimmed = sub.get("name", "").strip()
            if re.fullmatch(r"[a-zA-Z0-9_.]{2,30}", trimmed):
                handle = trimmed
    if not handle:
        return None
    handle = handle.rstrip(".")
    linked = instagram_profile_handle_from_url(sub.get("url", ""))
    if linked and linked == handle.lower():
        return None
    return handle


def pacific_offset(dt):
    """Return '-07:00' (PDT) or '-08:00' (PST) for a naive local datetime."""
    def nth_sunday(year, month, n):
        d = date(year, month, 1)
        d += timedelta(days=(6 - d.weekday()) % 7 + 7 * (n - 1))
        return d
    dst_start = nth_sunday(dt.year, 3, 2)
    dst_end = nth_sunday(dt.year, 11, 1)
    return "-07:00" if dst_start <= dt.date() < dst_end else "-08:00"


def iso_with_tz(dt_str):
    dt = datetime.strptime(dt_str[:16], "%Y-%m-%d %H:%M")
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + pacific_offset(dt)


# ---------------------------------------------------------------------------
# Page rendering
# ---------------------------------------------------------------------------

def style_version():
    try:
        with open("index.html", encoding="utf-8") as f:
            m = re.search(r"style\.css\?v=(\d+)", f.read())
            if m:
                return m.group(1)
    except OSError:
        pass
    return "37"


IG_ICON = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round">'
    '<rect x="3" y="3" width="18" height="18" rx="5"></rect>'
    '<circle cx="12" cy="12" r="4"></circle>'
    '<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle>'
    "</svg>"
)

GTAG = """  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-4Q0X3NY37Y"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-4Q0X3NY37Y');
  </script>
"""

NAV = """  <nav class="nav">
    <a href="/"><img class="nav-logo" src="/assets/driftwest-3d-favicon-r1.webp" alt="DriftWest"></a>

    <div class="nav-links">
      <a href="/#events">EVENTS</a>
      <a href="/#calendar">CALENDAR</a>
      <a href="/#media">MEDIA</a>
      <a href="/contributors.html">CONTRIBUTORS</a>
    </div>
  </nav>
"""

FOOTER = """<footer>
  <div class="footer-desc">""" + SITE_DESCRIPTION + """</div>
  <div>\u00a9 DriftWest</div>
</footer>
"""


def esc(s):
    return html.escape(s or "", quote=True)


def submission_card(s):
    ig_handle = instagram_handle_for(s)
    note = ""
    if s.get("note"):
        note = f'\n        <div class="photog-note">{esc(s["note"])}</div>'
    ig_btn = ""
    if ig_handle:
        ig_btn = (
            f'\n      <a class="photog-ig-btn" href="https://instagram.com/{esc(ig_handle)}"'
            f' target="_blank" rel="noopener">\n        {IG_ICON}<span>@{esc(ig_handle)}</span>\n      </a>'
        )
    return (
        '    <div class="photog-card">\n'
        f'      <a class="photog-card-link" href="{esc(s.get("url", "#"))}" target="_blank" rel="noopener">\n'
        f'        <div class="photog-role">{esc(role_label(s.get("role")))}</div>\n'
        f'        <div class="photog-name">{esc(s.get("name", "Unknown"))}</div>\n'
        f'        <div class="photog-platform">{esc(platform_label(s.get("url", "")))} \u203a</div>'
        f"{note}\n"
        "      </a>"
        f"{ig_btn}\n"
        "    </div>"
    )


def event_json_ld(group, canonical, date_full):
    data = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": group["title"],
        "startDate": iso_with_tz(group["start"]),
        "endDate": iso_with_tz(group["end"]),
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {"@type": "Place", "name": group.get("location", "")},
        "description": (group.get("notes") or
                        f"{group['title']} \u2014 {date_full} at {group.get('location', '')}. "
                        f"Presented by {group.get('promoter', 'DriftWest')}."),
        "url": canonical,
        "image": OG_IMAGE,
        "organizer": {"@type": "Organization", "name": group.get("promoter", "DriftWest")},
    }
    # Only future/ongoing events are "scheduled"; past ones simply omit status.
    try:
        end_dt = datetime.strptime(group["end"][:16], "%Y-%m-%d %H:%M")
        if end_dt >= datetime.now():
            data["eventStatus"] = "https://schema.org/EventScheduled"
    except ValueError:
        pass
    return json.dumps(data, ensure_ascii=False, indent=2)


def event_page_html(group, submissions, style_v):
    gid = group["days"][0]["id"]
    canonical = f"{SITE}/events/{gid}/"
    date_full = format_date_full(group["start"], group["end"])
    title = group["title"]
    location = group.get("location", "")
    promoter = group.get("promoter", "")
    notes = group.get("notes") or "More details coming soon."
    url = group.get("url", "")

    meta_desc = (f"{title} \u2014 {date_full} at {location}. "
                 f"Presented by {promoter}. Event details, registration info "
                 f"and photo/video galleries on DriftWest.")
    if len(meta_desc) > 300:
        meta_desc = meta_desc[:297] + "..."

    photog_subs = [s for s in submissions if s.get("role") != "driver"]
    driver_subs = [s for s in submissions if s.get("role") == "driver"]
    photog_html = "\n".join(submission_card(s) for s in photog_subs) or \
        '<div class="media-empty">No galleries posted yet for this event.</div>'
    driver_html = "\n".join(submission_card(s) for s in driver_subs) or \
        '<div class="media-empty">No driver clips posted yet for this event.</div>'

    reg_link = ""
    if url:
        reg_link = (f'\n    <a class="modal-link" href="{esc(url)}" target="_blank" '
                    f'rel="noopener">REGISTRATION / INFO \u203a</a>')

    json_ld = event_json_ld(group, canonical, date_full)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
{GTAG}
  <title>{esc(title)} | DriftWest</title>

  <meta name="description" content="{esc(meta_desc)}">

  <link rel="canonical" href="{canonical}">

  <meta property="og:title" content="{esc(title)} | DriftWest">
  <meta property="og:description" content="{esc(meta_desc)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="DriftWest">
  <meta property="og:image" content="{OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="800">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)} | DriftWest">
  <meta name="twitter:description" content="{esc(meta_desc)}">
  <meta name="twitter:image" content="{OG_IMAGE}">

  <link rel="icon" type="image/png" href="/assets/favicon.png?v=2">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-title" content="DriftWest">

  <link rel="stylesheet" href="/style.css?v={style_v}">

  <script type="application/ld+json">
{json_ld}
  </script>
</head>

<body>

<section class="hero media-hero">
{NAV}
  <div class="media-page">
    <div class="media-page-head">
      <a class="back-link" href="/#events">\u2039 ALL EVENTS</a>
      <div class="event-title">{esc(title)}</div>
      <div class="event-info">
        \U0001F4C5 {esc(date_full)}<br>
        \U0001F4CD {esc(location)}<br>
        \U0001F3C1 {esc(promoter)}
      </div>
    </div>

    <div class="modal-section">
      <h3>EVENT DETAILS</h3>
      <div class="modal-meta">{esc(notes)}</div>
    </div>{reg_link}

    <div class="section-title" style="margin-top:40px;">PHOTOGRAPHERS &amp; VIDEOGRAPHERS</div>
    <div class="photog-grid">
{photog_html}
    </div>

    <div class="section-title" style="margin-top:40px;">DRIVER CLIPS</div>
    <div class="photog-grid">
{driver_html}
    </div>

    <div class="submit-banner">
      <div class="submit-banner-title">SHOT THIS EVENT?</div>
      <div class="submit-banner-text">
        Photographer, videographer, or a driver with clips on your phone \u2014 submit your
        link and we\u2019ll add it here so everyone can find it.
      </div>
      <a class="modal-link" href="/submit-media.html?event={esc(gid)}">SUBMIT YOUR LINK \u203a</a>
    </div>

    <div class="modal-section">
      <h3>SHARE</h3>
      <div class="modal-meta">
        <button class="modal-share-btn" id="copy-link">COPY EVENT LINK</button>
        <span class="modal-share-status" id="copy-status"></span>
      </div>
    </div>
  </div>
</section>

{FOOTER}
<script>
(function(){{
  var btn = document.getElementById("copy-link");
  var status = document.getElementById("copy-status");
  var url = "{canonical}";
  btn.addEventListener("click", function(){{
    function done(msg){{ status.textContent = msg; setTimeout(function(){{ status.textContent = ""; }}, 2500); }}
    if(navigator.clipboard && navigator.clipboard.writeText){{
      navigator.clipboard.writeText(url).then(function(){{ done("Copied!"); }}, function(){{ done(url); }});
    }}else{{
      done(url);
    }}
  }});
}})();
</script>

</body>
</html>
"""


def redirect_page_html(group_gid):
    canonical = f"{SITE}/events/{group_gid}/"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Redirecting\u2026 | DriftWest</title>
  <link rel="canonical" href="{canonical}">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url={canonical}">
</head>
<body>
  <p>Redirecting to <a href="{canonical}">{canonical}</a>\u2026</p>
</body>
</html>
"""

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def submissions_for_group(group, media_data):
    day_ids = {d["id"] for d in group["days"]}
    subs = []
    for entry in media_data:
        if entry.get("eventId") in day_ids:
            subs.extend(entry.get("submissions", []))
    return subs


def write_sitemap(groups):
    static = [
        ("https://driftwest.net/", "daily", "1.0", None),
        ("https://driftwest.net/media.html", "weekly", "0.6", None),
        ("https://driftwest.net/contributors.html", "weekly", "0.6", None),
        ("https://driftwest.net/submit-media.html", "weekly", "0.6", None),
        ("https://driftwest.net/submit-event.html", "monthly", "0.5", None),
    ]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, prio, _ in static:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{prio}</priority>")
        lines.append("  </url>")
    for g in groups:
        gid = g["days"][0]["id"]
        added = (g.get("addedAt") or "")[:10] or date.today().isoformat()
        lines.append("  <url>")
        lines.append(f"    <loc>{SITE}/events/{gid}/</loc>")
        lines.append(f"    <lastmod>{added}</lastmod>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.8</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def build(json_events=None):
    if json_events is None:
        with open("events.json", encoding="utf-8") as f:
            json_events = json.load(f)
    try:
        with open("media.json", encoding="utf-8") as f:
            media_data = json.load(f)
    except (OSError, json.JSONDecodeError):
        media_data = []

    groups = group_multi_day(json_events)
    style_v = style_version()

    if os.path.isdir(EVENTS_DIR):
        shutil.rmtree(EVENTS_DIR)
    os.makedirs(EVENTS_DIR, exist_ok=True)

    page_count = 0
    redirect_count = 0
    for g in groups:
        gid = g["days"][0]["id"]
        subs = submissions_for_group(g, media_data)
        out_dir = os.path.join(EVENTS_DIR, gid)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(event_page_html(g, subs, style_v))
        page_count += 1
        for d in g["days"][1:]:
            rdir = os.path.join(EVENTS_DIR, d["id"])
            os.makedirs(rdir, exist_ok=True)
            with open(os.path.join(rdir, "index.html"), "w", encoding="utf-8") as f:
                f.write(redirect_page_html(gid))
            redirect_count += 1

    write_sitemap(groups)
    print(f"\u2705 event pages written: {page_count} event pages, "
          f"{redirect_count} day redirects, sitemap.xml updated")


if __name__ == "__main__":
    build()
