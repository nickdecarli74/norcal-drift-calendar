from ics import Calendar, Event
from datetime import datetime
import yaml

INPUT_FILE = "events.yaml"
OUTPUT_FILE = "norcal_drift_calendar.ics"

def parse_dt(value):
    return datetime.strptime(value, "%Y-%m-%d %H:%M")

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

cal = Calendar()

for item in data.get("events", []):
    e = Event()
    e.name = f"{item.get('promoter', 'Drift')} - {item['title']}"
    e.begin = parse_dt(item["start"])
    e.end = parse_dt(item["end"])
    e.location = item.get("location", "")

    description_parts = [
        f"Promoter: {item.get('promoter', '')}",
        f"Location: {item.get('location', '')}",
        f"Registration / Info: {item.get('url', '')}",
        "",
        item.get("notes", "")
    ]
    e.description = "\n".join(description_parts)

    if item.get("url"):
        e.url = item["url"]

    cal.events.add(e)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.writelines(cal)
