let allEvents = [];
let calendarDate = new Date(2026, 6, 1);

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

function eventUrl(e){
  return e.url || "#";
}

function renderNextEvent(events){
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start.replace(" ","T")) >= now);
  const next = upcoming.length ? upcoming[0] : events[0];

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

function renderUpcoming(events){
  const now = new Date();
  const upcoming = events
    .filter(e => new Date(e.start.replace(" ","T")) >= now)
    .slice(0, 8);

  document.getElementById("upcoming-events").innerHTML = upcoming.map(e => {
    const p = formatDateParts(e.start);
    return `
      <a class="small-card" href="${eventUrl(e)}" target="_blank" style="text-decoration:none;color:white">
        <div class="small-date">${p.full}</div>
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
    const dayEvents = allEvents.filter(e => e.start.startsWith(dateKey));

    html += `
      <div class="day-cell">
        <div class="day-number">${day}</div>
        ${dayEvents.map(e => `<button class="event-pill" type="button" onclick="openEventModal('${e.id}')">${e.promoter}</button>`).join("")}
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

  document.getElementById("modal-body").innerHTML = `
    <div class="modal-title">${e.title}</div>
    <div class="modal-meta">
      📅 ${p.full}<br>
      📍 ${e.location}<br>
      🏁 ${e.promoter}
    </div>
    <div class="modal-section">
      <h3>EVENT NOTES</h3>
      <div class="modal-meta">${e.notes || "More details coming soon."}</div>
    </div>
    <div class="modal-section">
      <h3>MEDIA</h3>
      <div class="modal-meta">Photos and videos will be added after the event.</div>
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

  const tracks = [
    {
      name: "Sonoma Raceway",
      location: "Sonoma, CA",
      lat: 38.1608,
      lng: -122.4544
    },
    {
      name: "Thunderhill Raceway",
      location: "Willows, CA",
      lat: 39.5393,
      lng: -122.3321
    },
    {
      name: "NASA Crows Landing Airport",
      location: "Crows Landing, CA",
      lat: 37.4083,
      lng: -121.1108
    },
    {
      name: "Salinas Municipal Airport",
      location: "Salinas, CA",
      lat: 36.6628,
      lng: -121.6063
    }
  ];

  const map = L.map("track-map", {
    scrollWheelZoom: false
  }).setView([37.95, -121.85], 7);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19
  }).addTo(map);

  tracks.forEach(track => {
    const trackEvents = allEvents.filter(e =>
      e.location.toLowerCase().includes(track.name.toLowerCase()) ||
      track.name.toLowerCase().includes(e.location.toLowerCase()) ||
      (track.name.includes("Crows") && e.location.toLowerCase().includes("crows")) ||
      (track.name.includes("Salinas") && e.location.toLowerCase().includes("salinas")) ||
      (track.name.includes("Thunderhill") && e.location.toLowerCase().includes("thunderhill")) ||
      (track.name.includes("Sonoma") && e.location.toLowerCase().includes("sonoma"))
    );

    const popupHtml = `
      <div class="map-popup-title">${track.name}</div>
      <div class="map-popup-meta">
        📍 ${track.location}<br>
        🏁 ${trackEvents.length} event${trackEvents.length === 1 ? "" : "s"} listed
      </div>
    `;

    L.circleMarker([track.lat, track.lng], {
      radius: 9,
      color: "#e10600",
      fillColor: "#e10600",
      fillOpacity: 0.9,
      weight: 2
    })
    .addTo(map)
    .bindPopup(popupHtml);
  });
}

fetch("events.json?v=" + Date.now())
  .then(res => res.json())
  .then(events => {
    allEvents = events.sort((a,b) => new Date(a.start.replace(" ","T")) - new Date(b.start.replace(" ","T")));

    const future = allEvents.find(e => new Date(e.start.replace(" ","T")) >= new Date());
    if(future){
      const d = new Date(future.start.replace(" ","T"));
      calendarDate = new Date(d.getFullYear(), d.getMonth(), 1);
    }

    renderNextEvent(allEvents);
    renderUpcoming(allEvents);
    renderCalendar();
  })
  .catch(() => {
    document.getElementById("next-event").innerHTML = "<div class='event-inner'>Could not load events.</div>";
  });
