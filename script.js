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
  },
  {
    name: "Qlispe Raceway Park",
    short: "Qlispe",
    location: "Airway Heights, WA",
    lat: 47.6672,
    lng: -117.5610,
    search: ["qlispe", "airway heights"]
  },
  {
    name: "The Mill Drift Track",
    short: "Sweet Home",
    location: "Sweet Home, OR",
    lat: 44.4031,
    lng: -122.7185,
    search: ["mill drift track", "sweet home"]
  },
  {
    name: "Affinity Circuit",
    short: "Affinity Circuit",
    location: "Central Point, OR",
    lat: 42.3733,
    lng: -122.9106,
    search: ["affinity"]
  },
  {
    name: "Firebird Motorsports Park",
    short: "Firebird",
    location: "Chandler, AZ",
    lat: 33.2689,
    lng: -111.9661,
    search: ["firebird", "radford"]
  },
  {
    name: "Musselman Honda Circuit",
    short: "MHC AZ",
    location: "Tucson, AZ",
    lat: 32.0855,
    lng: -110.789,
    search: ["musselman", "mhc"]
  },
  {
    name: "Redding Motorsports Park",
    short: "Redding",
    location: "Redding, CA",
    lat: 40.5138,
    lng: -122.2903,
    search: ["redding"]
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
  "GoodLuckLeague": "GLL",
  "Musselman Honda Circuit": "MHC AZ"
};

function pillLabel(event){
  return event.calendarLabel || PROMOTER_ABBREV[event.promoter] || event.promoter;
}

// Venues that run their own house events (Apple Valley Speedway, Musselman
// Honda Circuit, etc.) show up as both a Track and an identically-named
// Promoter. Real, but redundant in a Promoter filter — they stay fully
// selectable under Track, this just keeps them from being listed twice.
const VENUE_PROMOTERS = new Set(TRACKS.map(t => t.name));

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

function formatFeaturedDate(startStr, endStr){
  const start = new Date(startStr.replace(" ","T"));
  const sameDay = !endStr || startStr.slice(0,10) === endStr.slice(0,10);

  if(sameDay){
    return start.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
  }

  const end = new Date(endStr.replace(" ","T"));
  const startFmt = start.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const endFmt = end.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  return `${startFmt} – ${endFmt}, ${end.getFullYear()}`;
}

function formatFeaturedTimeRange(startStr, endStr){
  const fmt = str => new Date(str.replace(" ","T")).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true});
  return `${fmt(startStr)} – ${fmt(endStr)}`;
}

function renderFeaturedPartnerEvent(events){
  const container = document.getElementById("featured-partner-event");
  if(!container) return;

  const event = events.find(e => e.featuredPartner);

  if(!event){
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "";

  const roundMatch = event.title.match(/^(.*?)\s+Round\s+(\d+)$/i);
  const brandName = roundMatch ? roundMatch[1] : event.title;
  const roundLabel = roundMatch ? roundMatch[2].padStart(2,"0") : "";
  const initials = brandName.split(/\s+/).map(w => w[0]).join("").toUpperCase();

  const w = weatherFor(event);
  const forecastValue = w ? `${w.temp}°F` : "—";

  container.innerHTML = `
    <section class="dw-featured-event" aria-labelledby="dw-featured-event-title">
      <div class="dw-featured-event__header">
        <span class="dw-featured-event__eyebrow">Featured Event</span>
        <span class="dw-featured-event__header-line" aria-hidden="true"></span>
        <span class="dw-featured-event__slashes" aria-hidden="true">
          <i></i><i></i><i></i><i></i>
        </span>
      </div>

      <div class="dw-featured-event__layout">
        <div class="dw-featured-event__content">
          <div class="dw-featured-event__branding">
            <img
              class="dw-featured-event__logo"
              src="${event.logo || ""}"
              alt="${brandName}"
              onerror="this.hidden=true; this.nextElementSibling.hidden=false;"
            >
            <div class="dw-featured-event__logo-fallback" hidden>${initials}</div>

            ${roundLabel ? `<h3 class="dw-featured-event__round" id="dw-featured-event-title">Round <span>${roundLabel}</span></h3>` : ""}
          </div>

          <div class="dw-featured-event__details" aria-label="Event details">
            <div class="dw-featured-event__detail">
              <div class="dw-featured-event__icon" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <rect x="7" y="10" width="34" height="31" rx="3"></rect>
                  <path d="M15 6v8M33 6v8M7 19h34"></path>
                  <path d="M15 26h1M24 26h1M33 26h1M15 34h1M24 34h1M33 34h1"></path>
                </svg>
              </div>
              <div>
                <span class="dw-featured-event__label">Date</span>
                <span class="dw-featured-event__value">${formatFeaturedDate(event.start, event.end)}</span>
              </div>
            </div>

            <div class="dw-featured-event__detail">
              <div class="dw-featured-event__icon" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="17"></circle>
                  <path d="M24 14v11l8 5"></path>
                </svg>
              </div>
              <div>
                <span class="dw-featured-event__label">Time</span>
                <span class="dw-featured-event__value">${formatFeaturedTimeRange(event.start, event.end)}</span>
              </div>
            </div>

            <div class="dw-featured-event__detail">
              <div class="dw-featured-event__icon" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="M24 44s13-13.5 13-25A13 13 0 1 0 11 19c0 11.5 13 25 13 25z"></path>
                  <circle cx="24" cy="19" r="4.5"></circle>
                </svg>
              </div>
              <div>
                <span class="dw-featured-event__label">Location</span>
                <span class="dw-featured-event__value">${event.promoter} — ${event.location}</span>
              </div>
            </div>

            <div class="dw-featured-event__detail">
              <div class="dw-featured-event__icon" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4-1.7A4 4 0 0 0 6 16"></path>
                </svg>
              </div>
              <div>
                <span class="dw-featured-event__label">Forecast</span>
                <span class="dw-featured-event__value">${forecastValue}</span>
              </div>
            </div>
          </div>

          <div class="dw-featured-event__actions">
            <a
              class="dw-featured-event__button dw-featured-event__button--primary"
              href="${event.registerUrl || eventUrl(event)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Register</span>
              <span aria-hidden="true">→</span>
            </a>

            <a
              class="dw-featured-event__button dw-featured-event__button--secondary"
              href="media.html?event=${encodeURIComponent(event.id)}"
            >
              <span>View Media</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <aside class="dw-featured-event__track-card" aria-label="Track map">
          <div class="dw-featured-event__track-header">
            <div>
              <h3>Track Map</h3>
              <span class="dw-featured-event__track-accent" aria-hidden="true"></span>
            </div>
            <strong>${event.promoter}</strong>
          </div>

          <div class="dw-featured-event__map-frame">
            <img
              src="${event.trackMapImage || ""}"
              alt="${event.promoter} ${event.trackConfig || ""} configuration"
            >
          </div>

          <div class="dw-featured-event__track-meta">
            <span>Config: <b>${event.trackConfig || ""}</b></span>
            <span>Direction: <b>${event.trackDirection || ""}</b></span>
          </div>

          <div class="dw-featured-event__north" aria-hidden="true">
            <span>N</span>
            <span class="dw-featured-event__north-arrow">▲</span>
            <span class="dw-featured-event__compass">N</span>
          </div>

          <p class="dw-featured-event__track-note">${event.trackNote || ""}</p>
        </aside>
      </div>
    </section>
  `;
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

/* =========================================
   FILTER BAR (generic — shared by calendar + media)
   ========================================= */

function countByField(events, field){
  const c = {};
  events.forEach(e => { c[e[field]] = (c[e[field]]||0)+1; });
  return c;
}

function renderFilterBar(barEl, clearAllEl, defs, state, onChange){
  barEl.querySelectorAll(".dd").forEach(n => n.remove());

  defs.forEach(f => {
    const dd = document.createElement("div");
    dd.className = "dd";
    dd.dataset.key = f.key;

    const activeN = f.multi ? state[f.key].size : 0;
    const currentLabel = !f.multi
      ? (f.options.find(o => state[f.key].has(o.value)) || {}).label
      : null;

    dd.innerHTML = `
      <button class="dd-btn" type="button">
        <span class="lbl">${f.label}${currentLabel ? ": " + currentLabel : ""}</span>
        ${activeN ? `<span class="count">${activeN}</span>` : ""}
        <svg viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="dd-panel">
        ${f.searchable ? `<input class="dd-search" type="text" placeholder="Search ${f.label.toLowerCase()}…">` : ""}
        <div class="dd-list"></div>
        ${f.multi ? `<button class="dd-clear" type="button">Clear ${f.label}</button>` : ""}
      </div>
    `;
    if(activeN) dd.classList.add("active");

    const list = dd.querySelector(".dd-list");
    function paintOptions(filterText){
      list.innerHTML = "";
      const opts = f.options.filter(o => !filterText || o.label.toLowerCase().includes(filterText.toLowerCase()));
      if(!opts.length){
        list.innerHTML = `<div class="dd-empty">No matches</div>`;
        return;
      }
      opts.forEach(o => {
        const row = document.createElement("div");
        row.className = "dd-opt" + (!f.multi ? " radio" : "") + (state[f.key].has(o.value) ? " checked" : "");
        row.innerHTML = `
          <span class="box"><svg viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6"/></svg></span>
          <span>${o.label}</span>
          <span class="n">${o.n}</span>
        `;
        row.addEventListener("click", () => {
          if(f.multi){
            if(state[f.key].has(o.value)) state[f.key].delete(o.value);
            else state[f.key].add(o.value);
          } else {
            state[f.key] = new Set([o.value]);
          }
          onChange(f.key, o.value);
          if(f.multi){
            const reopened = barEl.querySelector(`.dd[data-key="${f.key}"]`);
            if(reopened) reopened.classList.add("open");
          }
        });
        list.appendChild(row);
      });
    }
    paintOptions("");

    const searchInput = dd.querySelector(".dd-search");
    if(searchInput){
      searchInput.addEventListener("input", () => paintOptions(searchInput.value));
      searchInput.addEventListener("click", e => e.stopPropagation());
    }

    dd.querySelector(".dd-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains("open");
      barEl.querySelectorAll(".dd.open").forEach(n => n.classList.remove("open"));
      if(!wasOpen) dd.classList.add("open");
    });

    const clearBtn = dd.querySelector(".dd-clear");
    if(clearBtn){
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state[f.key].clear();
        onChange(f.key, null);
      });
    }

    barEl.insertBefore(dd, clearAllEl);
  });

  const anyActive = defs.some(f => f.multi && state[f.key].size);
  clearAllEl.classList.toggle("show", anyActive);
}

function renderFilterChips(chipRowEl, defs, state, onChange){
  chipRowEl.innerHTML = "";
  defs.filter(f => f.multi).forEach(f => {
    state[f.key].forEach(value => {
      const opt = f.options.find(o => o.value === value);
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `${f.label}: ${opt ? opt.label : value} <button type="button">✕</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        state[f.key].delete(value);
        onChange(f.key, value);
      });
      chipRowEl.appendChild(chip);
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".dd.open").forEach(n => n.classList.remove("open"));
});

function monthLabel(ym){
  const [y,m] = ym.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleString("en-US",{month:"long",year:"numeric"});
}

/* ---- Calendar filter bar ---- */

const calendarFilterState = {promoter:new Set(), track:new Set(), month:new Set()};
let calendarFilterDefs = [];

function buildCalendarFilterDefs(){
  const promoterCounts = countByField(allEvents, "promoter");
  const trackOf = e => { const t = findTrackForEvent(e); return t ? t.name : null; };
  const trackCounts = {};
  allEvents.forEach(e => { const t = trackOf(e); if(t) trackCounts[t] = (trackCounts[t]||0)+1; });
  const monthCounts = {};
  allEvents.forEach(e => { const m = e.start.slice(0,7); monthCounts[m] = (monthCounts[m]||0)+1; });

  calendarFilterDefs = [
    {
      key:"promoter", label:"Promoter", searchable:true, multi:true,
      options: [...new Set(allEvents.map(e=>e.promoter))]
        .filter(v => !VENUE_PROMOTERS.has(v))
        .sort()
        .map(v=>({value:v, label:v, n:promoterCounts[v]}))
    },
    {
      key:"track", label:"Track", searchable:true, multi:true,
      options: [...new Set(allEvents.map(trackOf).filter(Boolean))]
        .sort()
        .map(v=>({value:v, label:v, n:trackCounts[v]}))
    },
    {
      key:"month", label:"Month", searchable:false, multi:false,
      options: [...new Set(allEvents.map(e=>e.start.slice(0,7)))]
        .sort()
        .map(v=>({value:v, label:monthLabel(v), n:monthCounts[v]}))
    }
  ];
}

function calendarFilterMatches(e){
  if(calendarFilterState.promoter.size && !calendarFilterState.promoter.has(e.promoter)) return false;
  if(calendarFilterState.track.size){
    const t = findTrackForEvent(e);
    if(!t || !calendarFilterState.track.has(t.name)) return false;
  }
  return true;
}

function onCalendarFilterChange(key, value){
  if(key === "month" && value){
    calendarDate = new Date(parseInt(value.slice(0,4)), parseInt(value.slice(5,7))-1, 1);
  }
  renderCalendarFilterBar();
  renderCalendar();
}

function renderCalendarFilterBar(){
  const bar = document.getElementById("calendar-filterbar");
  const clearAll = document.getElementById("calendar-clearall");
  const chipRow = document.getElementById("calendar-chiprow");
  if(!bar || !clearAll || !chipRow) return;

  const currentMonthKey = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,"0")}`;
  calendarFilterState.month = new Set([currentMonthKey]);

  renderFilterBar(bar, clearAll, calendarFilterDefs, calendarFilterState, onCalendarFilterChange);
  renderFilterChips(chipRow, calendarFilterDefs, calendarFilterState, onCalendarFilterChange);

  if(!clearAll.dataset.wired){
    clearAll.dataset.wired = "1";
    clearAll.addEventListener("click", () => {
      calendarFilterState.promoter.clear();
      calendarFilterState.track.clear();
      renderCalendarFilterBar();
      renderCalendar();
    });
  }
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

  const filterActive = calendarFilterState.promoter.size || calendarFilterState.track.size;

  for(let day=1;day<=daysInMonth;day++){
    const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayEvents = allEvents.filter(e => eventSpansDay(e, dateKey));

    html += `
      <div class="day-cell">
        <div class="day-number">${day}</div>
        ${dayEvents.map(e => {
          const dimmed = filterActive && !calendarFilterMatches(e);
          return `<button class="event-pill${dimmed ? " pill-dimmed" : ""}" type="button" onclick="openEventModal('${e.id}')">${pillLabel(e)}</button>`;
        }).join("")}
      </div>
    `;
  }

  grid.innerHTML = html;
}

function changeMonth(offset){
  calendarDate.setMonth(calendarDate.getMonth() + offset);
  renderCalendarFilterBar();
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
    zoomControl: true,
    // Finer zoom increments let fitBounds land closer to the exact padding
    // requested instead of snapping to the nearest whole zoom level - extra
    // headroom now that tracks span all the way from WA to Southern CA.
    zoomSnap: 0.25
  }).fitBounds(bounds, {padding: [55, 55]});

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

  // Mobile browsers resize the viewport after init (address bar collapsing
  // on scroll, orientation change) without firing a window resize event Leaflet
  // catches on its own - if the container's real size drifts from what Leaflet
  // measured at init, its pixel math goes stale and markers visibly wander/fly
  // off-screen as you zoom. Keep it in sync whenever the container's size changes.
  if(typeof ResizeObserver !== "undefined"){
    new ResizeObserver(() => map.invalidateSize()).observe(mapEl);
  }
  window.addEventListener("orientationchange", () => setTimeout(() => map.invalidateSize(), 300));
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

    renderFeaturedPartnerEvent(allEvents);
    renderNextEvent(allEvents);
    renderJustHappened(allEvents);
    renderUpcoming(allEvents);
    buildCalendarFilterDefs();
    renderCalendarFilterBar();
    renderCalendar();
    renderTrackMap();
    renderMediaSection(allEvents, mediaData);
    renderRecentSubmissions(allEvents, mediaData);

    loadWeather(allEvents).then(() => {
      renderFeaturedPartnerEvent(allEvents);
      renderUpcoming(allEvents);
    });
  })
  .catch(() => {
    document.getElementById("next-event").innerHTML = "<div class='event-inner'>Could not load events.</div>";
  });
