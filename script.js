let allEvents = [];
let allMedia = [];
let calendarDate = new Date(2026, 6, 1);
let weatherData = {};

const TRACKS = [
  {
    name: "Sonoma Raceway",
    short: "Sonoma",
    location: "Sonoma, CA",
    lat: 38.1608,
    lng: -122.4544,
    search: ["sonoma"]
  },
  {
    name: "Thunderhill Raceway",
    short: "Thunderhill",
    location: "Willows, CA",
    lat: 39.5393,
    lng: -122.3321,
    search: ["thunderhill"]
  },
  {
    name: "NASA Crows Landing Airport",
    short: "Crows Landing",
    location: "Crows Landing, CA",
    lat: 37.4083,
    lng: -121.1108,
    search: ["crows", "nasa crows"]
  },
  {
    name: "Salinas Municipal Airport",
    short: "Salinas",
    location: "Salinas, CA",
    lat: 36.6628,
    lng: -121.6063,
    search: ["salinas"]
  },
  {
    name: "San Joaquin County Fairgrounds",
    short: "Stockton",
    location: "Stockton, CA",
    lat: 37.9364,
    lng: -121.2657,
    search: ["san joaquin", "stockton"]
  },
  {
    name: "Apple Valley Speedway",
    short: "Apple Valley",
    location: "Apple Valley, CA",
    lat: 34.6221,
    lng: -117.1695,
    search: ["apple valley"]
  },
  {
    name: "Foresthill",
    short: "Foresthill",
    location: "Foresthill, CA",
    lat: 39.0020,
    lng: -120.8254,
    search: ["foresthill"]
  },
  {
    name: "Alameda County Fairgrounds",
    short: "Alameda Co. Fairgrounds",
    location: "Pleasanton, CA",
    lat: 37.6621,
    lng: -121.8747,
    search: ["alameda"]
  },
  {
    name: "Reno Fernley Raceway",
    short: "Reno Fernley",
    location: "Fernley, NV",
    lat: 39.5716,
    lng: -119.1855,
    search: ["fernley"]
  }
];

const WEATHER_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️",
  80: "🌦️", 81: "🌦️", 82: "🌦️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️"
};

function eventUrl(e){
  return e.url || "#";
}

function eventSpansDay(e, dateKey){
  const startDate = e.start.slice(0, 10);
  const endDate = (e.end || e.start).slice(0, 10);
  return dateKey >= startDate && dateKey <= endDate;
}

const PROMOTER_ABBREV = {
  "Apple Valley Speedway": "AVS",
  "Valley Drift Club": "VDC",
  "Bay Area Drifting": "BAD",
  "Fast In Fast Out": "FIFO",
  "Drift Central": "DC",
  "Outlaw Drift": "OD",
  "GoodLuckLeague": "GLL"
};

function pillLabel(promoter){
  return PROMOTER_ABBREV[promoter] || promoter;
}

function findTrackForEvent(e){
  const haystack = `${e.location || ""} ${e.promoter || ""}`.toLowerCase();
  return TRACKS.find(track => track.search.some(term => haystack.includes(term))) || null;
}

function weatherFor(e){
  const track = findTrackForEvent(e);
  if(!track) return null;
  const byDate = weatherData[track.short];
  if(!byDate) return null;
  return byDate[e.start.slice(0,10)] || null;
}

function weatherBadge(e){
  const w = weatherFor(e);
  if(!w) return "";
  const icon = WEATHER_ICONS[w.code] || "🌡️";
  return `<span class="weather-badge">${icon} ${w.temp}°F</span>`;
}

function loadWeather(events){
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 16);

  const neededTracks = [];
  const seen = new Set();

  events.forEach(e => {
    const start = new Date(e.start.replace(" ","T"));
    if(start < now || start > horizon) return;

    const track = findTrackForEvent(e);
    if(track && !seen.has(track.short)){
      seen.add(track.short);
      neededTracks.push(track);
    }
  });

  if(!neededTracks.length) return Promise.resolve();

  const lats = neededTracks.map(t => t.lat).join(",");
  const lngs = neededTracks.map(t => t.lng).join(",");

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&daily=weathercode,temperature_2m_max&temperature_unit=fahrenheit` +
    `&timezone=America%2FLos_Angeles&forecast_days=16`;

  return fetch(url)
    .then(res => res.json())
    .then(data => {
      const results = Array.isArray(data) ? data : [data];

      results.forEach((result, i) => {
        const track = neededTracks[i];
        if(!track || !result.daily) return;

        const byDate = {};
        result.daily.time.forEach((dateKey, idx) => {
          byDate[dateKey] = {
            code: result.daily.weathercode[idx],
            temp: Math.round(result.daily.temperature_2m_max[idx])
          };
        });

        weatherData[track.short] = byDate;
      });
    })
    .catch(() => {});
}

function renderNextEvent(events){
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start.replace(" ","T")) >= now);

  const featuredNext = upcoming
    .filter(e => e.featuredNext)
    .sort((a,b) => new Date(a.start.replace(" ","T")) - new Date(b.start.replace(" ","T")))[0];

  const next = featuredNext || (upcoming.length ? upcoming[0] : events[0]);

  if(!next){
    document.getElementById("next-event").innerHTML = "";
    return;
  }

  const p = formatDateParts(next.start);

  document.getElementById("next-event").innerHTML = `
    <div class="event-inner">
      <div class="date">
        <div class="next">NEXT EVENT</div>
        <div class="month">${p.month}</div>
        <div class="day">${p.day}</div>
        <div class="year">${p.year}</div>
      </div>
      <div>
        <div class="event-title">${next.title}</div>
        <div class="event-info">
          📍 ${next.location}<br>
          🏁 ${next.promoter}<br>
          🕘 ${p.full}
        </div>
        <a class="view-btn" href="${eventUrl(next)}" target="_blank">VIEW EVENT ›</a>
      </div>
    </div>
  `;
}

function renderJustHappened(events){
  const container = document.getElementById("just-happened");
  if(!container) return;

  const now = new Date();
  const pastEvents = events.filter(e => new Date(e.start.replace(" ","T")) < now);

  const featured = pastEvents
    .filter(e => e.featured)
    .sort((a,b) => new Date(b.start.replace(" ","T")) - new Date(a.start.replace(" ","T")))[0];

  const automatic = pastEvents
    .filter(e => mediaWindowOpen(e))
    .sort((a,b) => new Date(b.start.replace(" ","T")) - new Date(a.start.replace(" ","T")))[0];

  const event = featured || automatic;

  if(!event){
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "";
  const p = formatDateParts(event.start);

  container.innerHTML = `
    <div class="event-inner">
      <div class="date">
        <div class="next">JUST HAPPENED</div>
        <div class="month">${p.month}</div>
        <div class="day">${p.day}</div>
        <div class="year">${p.year}</div>
      </div>
      <div>
        <div class="event-title">${event.title}</div>
        <div class="event-info">
          📍 ${event.location}<br>
          🏁 ${event.promoter}<br>
          🕘 ${p.full}
        </div>
        <a class="view-btn" href="media.html?event=${encodeURIComponent(event.id)}">VIEW MEDIA ›</a>
      </div>
    </div>
  `;
}

function renderUpcoming(events){
  const now = new Date();
  const upcoming = events
    .filter(e => new Date(e.start.replace(" ","T")) >= now)
    .slice(0, 8);

  document.getElementById("upcoming-events").innerHTML = upcoming.map(e => {
    const p = formatDateParts(e.start);
    return `
      <a class="small-card" href="${eventUrl(e)}" target="_blank" style="text-decoration:none;color:white">
        <div class="small-date">${p.full}${weatherBadge(e)}</div>
        <div class="small-title">${e.title}</div>
        <div class="small-meta">
          ${e.promoter}<br>
          ${e.location}
        </div>
      </a>
    `;
  }).join("");
}

function renderCalendar(){
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendar-title");

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  title.textContent = calendarDate.toLocaleString("en-US",{month:"long",year:"numeric"}).toUpperCase();

  const weekdays = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  let html = weekdays.map(d => `<div class="weekday">${d}</div>`).join("");

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for(let i=0;i<firstDay;i++){
    html += `<div class="day-cell empty"></div>`;
  }

  for(let day=1;day<=daysInMonth;day++){
    const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayEvents = allEvents.filter(e => eventSpansDay(e, dateKey));

    html += `
      <div class="day-cell">
        <div class="day-number">${day}</div>
        ${dayEvents.map(e => `<button class="event-pill" type="button" onclick="openEventModal('${e.id}')">${pillLabel(e.promoter)}</button>`).join("")}
      </div>
    `;
  }

  grid.innerHTML = html;
}

function changeMonth(offset){
  calendarDate.setMonth(calendarDate.getMonth() + offset);
  renderCalendar();
}

function openEventModal(eventId){
  const e = allEvents.find(x => x.id === eventId);
  if(!e) return;

  const p = formatDateParts(e.start);
  const w = weatherBadge(e);

  const mediaMeta = allMedia.find(m => m.eventId === e.id);
  const mediaCount = mediaMeta ? mediaMeta.submissions.length : 0;
  let mediaHtml;
  if(mediaCount){
    mediaHtml = `${mediaCount} ${mediaCount === 1 ? "submission" : "submissions"} posted. <a class="modal-link" href="media.html?event=${encodeURIComponent(e.id)}">View gallery ›</a>`;
  } else if(mediaWindowOpen(e)){
    mediaHtml = `Shot this event? <a class="modal-link" href="media.html?event=${encodeURIComponent(e.id)}">Submit your link ›</a>`;
  } else {
    mediaHtml = `Photos and videos will be added after the event.`;
  }

  document.getElementById("modal-body").innerHTML = `
    <div class="modal-title">${e.title}</div>
    <div class="modal-meta">
      📅 ${p.full}<br>
      📍 ${e.location}<br>
      🏁 ${e.promoter}${w ? `<br>${w}` : ""}
    </div>
    <div class="modal-section">
      <h3>EVENT NOTES</h3>
      <div class="modal-meta">${e.notes || "More details coming soon."}</div>
    </div>
    <div class="modal-section">
      <h3>MEDIA</h3>
      <div class="modal-meta">${mediaHtml}</div>
    </div>
    <a class="modal-link" href="${eventUrl(e)}" target="_blank">REGISTRATION / INFO ›</a>
  `;

  document.getElementById("event-modal").style.display = "flex";
}

function closeEventModal(){
  document.getElementById("event-modal").style.display = "none";
}

function renderTrackMap(){
  const mapEl = document.getElementById("track-map");
  if(!mapEl || typeof L === "undefined") return;

  if(mapEl.dataset.loaded === "true") return;
  mapEl.dataset.loaded = "true";

  const bounds = L.latLngBounds(TRACKS.map(t => [t.lat, t.lng]));

  const map = L.map("track-map", {
    scrollWheelZoom: false,
    zoomControl: true
  }).fitBounds(bounds, {padding: [40, 40]});

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19
  }).addTo(map);

  const driftIcon = L.divIcon({
    className: "drift-marker",
    html: "<div class='marker-core'></div><div class='marker-pulse'></div>",
    iconSize: [34,34],
    iconAnchor: [17,17]
  });

  TRACKS.forEach(track => {
    const trackEvents = allEvents.filter(e => findTrackForEvent(e) === track);

    const nextEvent = trackEvents
      .filter(e => new Date(e.start.replace(" ","T")) >= new Date())
      .sort((a,b) => new Date(a.start.replace(" ","T")) - new Date(b.start.replace(" ","T")))[0];

    const popupHtml = `
      <div class="map-popup-title">${track.name}</div>
      <div class="map-popup-meta">
        📍 ${track.location}<br>
        🏁 ${trackEvents.length} event${trackEvents.length === 1 ? "" : "s"} listed<br>
        ${nextEvent ? `🔥 Next: ${nextEvent.title}` : "No upcoming events listed"}
      </div>
      <a class="map-popup-button" href="#calendar">VIEW CALENDAR</a>
    `;

    L.marker([track.lat, track.lng], {icon: driftIcon})
      .addTo(map)
      .bindPopup(popupHtml);
  });
}
function openSubscribeModal(){
  document.getElementById("subscribe-modal").style.display = "flex";
}

function closeSubscribeModal(){
  document.getElementById("subscribe-modal").style.display = "none";
}
Promise.all([
  fetch("events.json?v=" + Date.now()).then(res => res.json()),
  fetch("media.json?v=" + Date.now()).then(res => res.json()).catch(() => [])
])
  .then(([events, mediaData]) => {
    allEvents = events.sort((a,b) => new Date(a.start.replace(" ","T")) - new Date(b.start.replace(" ","T")));
    allMedia = mediaData;

    const future = allEvents.find(e => new Date(e.start.replace(" ","T")) >= new Date());
    if(future){
      const d = new Date(future.start.replace(" ","T"));
      calendarDate = new Date(d.getFullYear(), d.getMonth(), 1);
    }

    renderNextEvent(allEvents);
    renderJustHappened(allEvents);
    renderUpcoming(allEvents);
    renderCalendar();
    renderTrackMap();
    renderMediaSection(allEvents, mediaData);
    renderRecentSubmissions(allEvents, mediaData);

    loadWeather(allEvents).then(() => {
      renderUpcoming(allEvents);
    });
  })
  .catch(() => {
    document.getElementById("next-event").innerHTML = "<div class='event-inner'>Could not load events.</div>";
  });
