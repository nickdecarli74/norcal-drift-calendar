from ics import Calendar, Event
from datetime import datetime

cal = Calendar()

def add_event(title, start_str, duration_hours, location, description):
    e = Event()
    e.name = title
    e.begin = datetime.strptime(start_str, "%Y-%m-%d %H:%M")
    e.duration = {"hours": duration_hours}
    e.location = location
    e.description = description
    cal.events.add(e)

add_event(
    "Good Luck League - Open Drift Day",
    "2026-07-20 09:00",
    8,
    "Sonoma Raceway",
    "Driver: $250 | Helmet required | Beginner friendly"
)

add_event(
    "DriftSF Practice Day",
    "2026-07-27 10:00",
    6,
    "Thunderhill Raceway",
    "DriftSF open practice session"
)

add_event(
    "Valley Drift Club Session",
    "2026-08-03 09:00",
    8,
    "Crows Landing",
    "Tandem practice allowed"
)

with open("norcal_drift_calendar.ics", "w") as f:
    f.writelines(cal)
