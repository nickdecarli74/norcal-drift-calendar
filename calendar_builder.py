from ics import Calendar, Event
import yaml
from datetime import datetime

with open("sources.yaml", "r") as f:
    config = yaml.safe_load(f)

cal = Calendar()

def add_event(title, start, duration_hours, location, description):
    e = Event()
    e.name = title
    e.begin = start
    e.duration = {"hours": duration_hours}
    e.location = location
    e.description = description
    cal.events.add(e)

# ----------------------------
# TEMP SAMPLE EVENTS (we replace with real scraping next step)
# ----------------------------

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

# Output calendar
with open("norcal_drift_calendar.ics", "w") as f:
    f.writelines(cal)
