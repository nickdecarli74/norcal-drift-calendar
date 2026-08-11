/* =========================================
   MEDIA HUB LOGIC
   Shared by index.html (#media section)
   and media.html (per-event gallery page)
   ========================================= */

function formatDateParts(dateStr){
  const d = new Date(dateStr.replace(" ", "T"));
  return {
    date: d,
    month: d.toLocaleString("en-US",{month:"short"}).toUpperCase(),
    day: d.getDate(),
    year: d.getFullYear(),
    full: d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
  };
}

function platformLabel(url){
  try{
    const host = new URL(url).hostname.replace("www.","");
    if(host.includes("instagram")) return "Instagram";
    if(host.includes("youtube") || host.includes("youtu.be")) return "YouTube";
    if(host.includes("drive.google")) return "Google Drive";
    if(host.includes("photos.google") || host.includes("photos.app.goo.gl")) return "Google Photos";
    if(host.includes("dropbox")) return "Dropbox";
    if(host.includes("vimeo")) return "Vimeo";
    if(host.includes("tiktok")) return "TikTok";
    if(host.includes("smugmug")) return "SmugMug";
    if(host.includes("flickr")) return "Flickr";
    return host;
  }catch(e){
    return "Link";
  }
}

function roleLabel(role){
  if(role === "video") return "🎥 Videographer";
  if(role === "photo") return "📷 Photographer";
  if(role === "both") return "📸 Photographer & Videographer";
  if(role === "driver") return "🚗 Driver Clip";
  return "📸 Media";
}

function roleIcon(role){
  if(role === "video") return "🎥";
  if(role === "both") return "📸";
  return "📷";
}

function roleName(role){
  if(role === "video") return "Videographer";
  if(role === "both") return "Photographer & Videographer";
  return "Photographer";
}

function timeAgo(dateString){
  const then = new Date(dateString);
  const now = new Date();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if(minutes < 1) return "just now";
  if(minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if(hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const MEDIA_WINDOW_BEFORE_DAYS = 7;
const MEDIA_WINDOW_AFTER_DAYS = 60;

// Submissions are open from 7 days before an event through 60 days after it.
function mediaWindowOpen(event){
  const start = new Date(event.start.replace(" ","T"));
  const opens = new Date(start);
  opens.setDate(opens.getDate() - MEDIA_WINDOW_BEFORE_DAYS);
  const closes = new Date(start);
  closes.setDate(closes.getDate() + MEDIA_WINDOW_AFTER_DAYS);

  const now = new Date();
  return now >= opens && now <= closes;
}

/* ---- Homepage: MEDIA section (event grid) ---- */

let mediaCards = [];
const mediaFilterState = {promoter:new Set(), track:new Set(), month:new Set(), media:new Set()};
let mediaFilterDefs = [];

function renderMediaSection(events, mediaData){
  const grid = document.getElementById("media-grid");
  if(!grid) return;

  const withSubmissions = mediaData
    .map(m => {
      const e = events.find(ev => ev.id === m.eventId);
      return e ? {meta: m, event: e} : null;
    })
    .filter(Boolean);

  const submittedIds = new Set(withSubmissions.map(x => x.event.id));

  const openForSubmission = events
    .filter(e => !submittedIds.has(e.id) && mediaWindowOpen(e))
    .map(e => ({meta: {eventId: e.id, submissions: []}, event: e}));

  const cards = [...withSubmissions, ...openForSubmission]
    .sort((a,b) => new Date(b.event.start.replace(" ","T")) - new Date(a.event.start.replace(" ","T")));

  mediaCards = cards;

  const bar = document.getElementById("media-filterbar");
  const chipRow = document.getElementById("media-chiprow");

  if(!cards.length){
    grid.innerHTML = `<div class="media-empty">No event galleries posted yet. Check back after the next event.</div>`;
    if(bar) bar.style.display = "none";
    if(chipRow) chipRow.style.display = "none";
    return;
  }

  if(bar) bar.style.display = "";
  if(chipRow) chipRow.style.display = "";

  grid.innerHTML = cards.map(({meta, event}) => {
    const p = formatDateParts(event.start);
    const count = meta.submissions.length;
    const metaLine = count
      ? `${count} ${count === 1 ? "submission" : "submissions"} posted`
      : "Shot this event? Be the first to submit";
    const linkLabel = count ? "VIEW GALLERY ›" : "SUBMIT YOUR LINK ›";

    return `
      <a class="media-card" data-id="${event.id}" href="media.html?event=${encodeURIComponent(event.id)}">
        <div class="media-card-date">${p.full}</div>
        <div class="media-card-title">${event.title}</div>
        <div class="media-card-meta">
          📍 ${event.location}<br>
          ${metaLine}
        </div>
        <div class="media-card-link">${linkLabel}</div>
      </a>
    `;
  }).join("");

  buildMediaFilterDefs();
  renderMediaFilterBar();
  applyMediaFilters();
}

function buildMediaFilterDefs(){
  const trackOf = e => { const t = findTrackForEvent(e); return t ? t.name : null; };

  const promoterCounts = {};
  const trackCounts = {};
  const monthCounts = {};
  const mediaTypeCounts = {photo:0, video:0, driver:0};

  mediaCards.forEach(({meta, event}) => {
    promoterCounts[event.promoter] = (promoterCounts[event.promoter]||0)+1;
    const t = trackOf(event);
    if(t) trackCounts[t] = (trackCounts[t]||0)+1;
    const m = event.start.slice(0,7);
    monthCounts[m] = (monthCounts[m]||0)+1;
    if(meta.submissions.some(s=>s.role==="photo"||s.role==="both")) mediaTypeCounts.photo++;
    if(meta.submissions.some(s=>s.role==="video"||s.role==="both")) mediaTypeCounts.video++;
    if(meta.submissions.some(s=>s.role==="driver")) mediaTypeCounts.driver++;
  });

  mediaFilterDefs = [
    {
      key:"promoter", label:"Promoter", searchable:true, multi:true,
      options: [...new Set(mediaCards.map(c=>c.event.promoter))]
        .filter(v => !VENUE_PROMOTERS.has(v))
        .sort()
        .map(v=>({value:v, label:v, n:promoterCounts[v]}))
    },
    {
      key:"track", label:"Track", searchable:true, multi:true,
      options: [...new Set(mediaCards.map(c=>trackOf(c.event)).filter(Boolean))]
        .sort()
        .map(v=>({value:v, label:v, n:trackCounts[v]}))
    },
    {
      key:"month", label:"Month", searchable:false, multi:true,
      options: [...new Set(mediaCards.map(c=>c.event.start.slice(0,7)))]
        .sort()
        .map(v=>({value:v, label:monthLabel(v), n:monthCounts[v]}))
    },
    {
      key:"media", label:"Media Type", searchable:false, multi:true,
      options: [
        {value:"photo", label:"Photo", n:mediaTypeCounts.photo},
        {value:"video", label:"Video", n:mediaTypeCounts.video},
        {value:"driver", label:"Driver Clips", n:mediaTypeCounts.driver}
      ]
    }
  ];
}

function mediaCardMatches({meta, event}){
  if(mediaFilterState.promoter.size && !mediaFilterState.promoter.has(event.promoter)) return false;
  if(mediaFilterState.track.size){
    const t = findTrackForEvent(event);
    if(!t || !mediaFilterState.track.has(t.name)) return false;
  }
  if(mediaFilterState.month.size && !mediaFilterState.month.has(event.start.slice(0,7))) return false;
  if(mediaFilterState.media.size){
    const ok = [...mediaFilterState.media].some(type => {
      if(type === "driver") return meta.submissions.some(s=>s.role==="driver");
      return meta.submissions.some(s=>s.role===type || s.role==="both");
    });
    if(!ok) return false;
  }
  return true;
}

function applyMediaFilters(){
  const grid = document.getElementById("media-grid");
  if(!grid) return;

  let shown = 0;
  grid.querySelectorAll(".media-card").forEach(card => {
    const c = mediaCards.find(x => x.event.id === card.dataset.id);
    const match = c ? mediaCardMatches(c) : true;
    card.classList.toggle("filtered-out", !match);
    if(match) shown++;
  });

  let emptyNote = document.getElementById("media-filter-empty");
  const anyFilterActive = mediaFilterDefs.some(f => mediaFilterState[f.key].size);

  if(shown === 0 && anyFilterActive){
    if(!emptyNote){
      emptyNote = document.createElement("div");
      emptyNote.id = "media-filter-empty";
      emptyNote.className = "filter-empty-note";
      grid.insertAdjacentElement("afterend", emptyNote);
    }
    emptyNote.textContent = "No galleries match this combination — try clearing a filter.";
    emptyNote.style.display = "";
  } else if(emptyNote){
    emptyNote.style.display = "none";
  }
}

function onMediaFilterChange(){
  renderMediaFilterBar();
  applyMediaFilters();
}

function renderMediaFilterBar(){
  const bar = document.getElementById("media-filterbar");
  const clearAll = document.getElementById("media-clearall");
  const chipRow = document.getElementById("media-chiprow");
  if(!bar || !clearAll || !chipRow) return;

  renderFilterBar(bar, clearAll, mediaFilterDefs, mediaFilterState, onMediaFilterChange);
  renderFilterChips(chipRow, mediaFilterDefs, mediaFilterState, onMediaFilterChange);

  if(!clearAll.dataset.wired){
    clearAll.dataset.wired = "1";
    clearAll.addEventListener("click", () => {
      mediaFilterDefs.forEach(f => mediaFilterState[f.key].clear());
      renderMediaFilterBar();
      applyMediaFilters();
    });
  }
}

/* ---- Homepage: recent submissions feed ---- */

const RECENT_SUBMISSIONS_LIMIT = 6;

function renderRecentSubmissions(events, mediaData){
  const wrap = document.getElementById("recent-submissions-wrap");
  const list = document.getElementById("recent-submissions");
  if(!wrap || !list) return;

  const entries = mediaData.flatMap(m => {
    const event = events.find(ev => ev.id === m.eventId);
    if(!event) return [];
    return m.submissions
      .filter(s => s.role !== "driver" && s.addedAt)
      .map(s => ({submission: s, event}));
  });

  entries.sort((a,b) => new Date(b.submission.addedAt) - new Date(a.submission.addedAt));
  const recent = entries.slice(0, RECENT_SUBMISSIONS_LIMIT);

  if(!recent.length){
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "";
  list.innerHTML = recent.map(({submission, event}) => `
    <a class="feed-row" href="media.html?event=${encodeURIComponent(event.id)}">
      <div class="feed-icon">${roleIcon(submission.role)}</div>
      <div class="feed-body">
        <div class="feed-line1">${submission.name} <span class="event-tag">${event.title}</span></div>
        <div class="feed-line2">${roleName(submission.role)}<span class="dot-sep">·</span>${platformLabel(submission.url)}</div>
      </div>
      <div class="feed-right">
        <span class="feed-time">${timeAgo(submission.addedAt)}</span>
        <span class="feed-chevron">›</span>
      </div>
    </a>
  `).join("");
}

/* ---- Instagram handle detection ----
   Most submitters put their Instagram handle straight into the "Name/Handle"
   form field. We derive a profile link from that (or an @mention inside it)
   rather than requiring a separate form field, and skip it when the main
   submission link already points at that same Instagram profile. */

function instagramProfileHandleFromUrl(url){
  try{
    const u = new URL(url);
    if(!u.hostname.replace("www.","").includes("instagram")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if(!parts.length) return null;
    const reserved = new Set(["p","reel","reels","stories","tv","explore"]);
    if(reserved.has(parts[0].toLowerCase())) return null;
    return parts[0].toLowerCase();
  }catch(e){
    return null;
  }
}

function instagramHandleFor(s){
  let handle = null;

  if(s.instagram){
    handle = s.instagram.trim().replace(/^@/,"");
  }else{
    const mention = s.name.match(/@([a-zA-Z0-9_.]{2,30})/);
    if(mention){
      handle = mention[1];
    }else{
      const trimmed = s.name.trim();
      if(/^[a-zA-Z0-9_.]{2,30}$/.test(trimmed)) handle = trimmed;
    }
  }

  if(!handle) return null;
  handle = handle.replace(/\.+$/,"");

  const linkedProfile = instagramProfileHandleFromUrl(s.url);
  if(linkedProfile && linkedProfile === handle.toLowerCase()) return null;

  return handle;
}

/* ---- media.html: single event gallery page ---- */

function renderMediaPage(events, mediaData){
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event");

  const container = document.getElementById("media-page");
  if(!container) return;

  const event = events.find(e => e.id === eventId);
  const meta = mediaData.find(m => m.eventId === eventId);

  if(!event){
    container.innerHTML = `
      <div class="media-page-empty">
        <div class="section-title">EVENT NOT FOUND</div>
        <div class="modal-meta">We couldn't find that event. <a class="modal-link" href="index.html#media">Back to Media</a></div>
      </div>
    `;
    return;
  }

  const p = formatDateParts(event.start);
  document.title = `${event.title} — Media | DriftWest`;

  const submissions = meta ? meta.submissions : [];
  const photogSubs = submissions.filter(s => s.role !== "driver");
  const driverSubs = submissions.filter(s => s.role === "driver");

  const igIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5"></rect>
      <circle cx="12" cy="12" r="4"></circle>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle>
    </svg>
  `;

  const cardHtml = s => {
    const igHandle = instagramHandleFor(s);
    return `
    <div class="photog-card">
      <a class="photog-card-link" href="${s.url}" target="_blank" rel="noopener">
        <div class="photog-role">${roleLabel(s.role)}</div>
        <div class="photog-name">${s.name}</div>
        <div class="photog-platform">${platformLabel(s.url)} ›</div>
        ${s.note ? `<div class="photog-note">${s.note}</div>` : ""}
      </a>
      ${igHandle ? `
        <a class="photog-ig-btn" href="https://instagram.com/${igHandle}" target="_blank" rel="noopener">
          ${igIcon}<span>@${igHandle}</span>
        </a>
      ` : ""}
    </div>
  `;
  };

  const photogHtml = photogSubs.length
    ? photogSubs.map(cardHtml).join("")
    : `<div class="media-empty">No galleries posted yet for this event.</div>`;

  const driverHtml = driverSubs.length
    ? driverSubs.map(cardHtml).join("")
    : `<div class="media-empty">No driver clips posted yet for this event.</div>`;

  container.innerHTML = `
    <div class="media-page-head">
      <a class="back-link" href="index.html#media">‹ ALL EVENTS</a>
      <div class="event-title">${event.title}</div>
      <div class="event-info">
        📅 ${p.full}<br>
        📍 ${event.location}<br>
        🏁 ${event.promoter}
      </div>
    </div>

    <div class="section-title" style="margin-top:40px;">PHOTOGRAPHERS &amp; VIDEOGRAPHERS</div>
    <div class="photog-grid">${photogHtml}</div>

    <div class="section-title" style="margin-top:40px;">DRIVER CLIPS</div>
    <div class="photog-grid">${driverHtml}</div>

    <div class="submit-banner">
      <div class="submit-banner-title">SHOT THIS EVENT?</div>
      <div class="submit-banner-text">
        Photographer, videographer, or a driver with clips on your phone — submit your
        link and we'll add it here so everyone can find it.
      </div>
      <a class="modal-link" href="https://docs.google.com/forms/d/e/1FAIpQLSfgvWh9QZlCBY46bMQCUbZy4DMaewADwCGHScMELIs4Wby_Rg/viewform" target="_blank" rel="noopener">SUBMIT YOUR LINK ›</a>
    </div>
  `;
}
