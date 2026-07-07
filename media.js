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
  return "📸 Media";
}

/* ---- Homepage: MEDIA section (event grid) ---- */

function renderMediaSection(events, mediaData){
  const grid = document.getElementById("media-grid");
  if(!grid) return;

  if(!mediaData.length){
    grid.innerHTML = `<div class="media-empty">No event galleries posted yet. Check back after the next event.</div>`;
    return;
  }

  const withEvents = mediaData
    .map(m => {
      const e = events.find(ev => ev.id === m.eventId);
      return e ? {meta: m, event: e} : null;
    })
    .filter(Boolean)
    .sort((a,b) => new Date(b.event.start.replace(" ","T")) - new Date(a.event.start.replace(" ","T")));

  grid.innerHTML = withEvents.map(({meta, event}) => {
    const p = formatDateParts(event.start);
    const count = meta.submissions.length;
    return `
      <a class="media-card" href="media.html?event=${encodeURIComponent(event.id)}">
        <div class="media-card-date">${p.full}</div>
        <div class="media-card-title">${event.title}</div>
        <div class="media-card-meta">
          📍 ${event.location}<br>
          ${count} ${count === 1 ? "submission" : "submissions"} posted
        </div>
        <div class="media-card-link">VIEW GALLERY ›</div>
      </a>
    `;
  }).join("");
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

  const cardsHtml = submissions.length
    ? submissions.map(s => `
        <a class="photog-card" href="${s.url}" target="_blank" rel="noopener">
          <div class="photog-role">${roleLabel(s.role)}</div>
          <div class="photog-name">${s.name}</div>
          <div class="photog-platform">${platformLabel(s.url)} ›</div>
          ${s.note ? `<div class="photog-note">${s.note}</div>` : ""}
        </a>
      `).join("")
    : `<div class="media-empty">No galleries posted yet for this event. Shot it? <a class="modal-link" href="https://docs.google.com/forms/d/e/1FAIpQLSfgvWh9QZlCBY46bMQCUbZy4DMaewADwCGHScMELIs4Wby_Rg/viewform" target="_blank" rel="noopener">Submit your link</a>.</div>`;

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
    <div class="photog-grid">${cardsHtml}</div>

    <div class="submit-banner">
      <div class="submit-banner-title">SHOT THIS EVENT?</div>
      <div class="submit-banner-text">
        Submit your album, reel, or channel link and we'll add it here so drivers can find your work.
      </div>
      <a class="modal-link" href="https://docs.google.com/forms/d/e/1FAIpQLSfgvWh9QZlCBY46bMQCUbZy4DMaewADwCGHScMELIs4Wby_Rg/viewform" target="_blank" rel="noopener">SUBMIT YOUR LINK ›</a>
    </div>
  `;
}
