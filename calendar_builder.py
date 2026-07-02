from ics import Calendar, Event
from datetime import datetime
import yaml
import json
from datetime import datetime, timezone

INPUT_FILE = "events.yaml"
ICS_OUTPUT = "norcal_drift_calendar.ics"
JSON_OUTPUT = "events.json"

def parse_dt(value):
    return datetime.strptime(value, "%Y-%m-%d %H:%M")

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

events = data.get("events", [])
cal = Calendar()
json_events = []

for item in events:
    start = parse_dt(item["start"])
    end = parse_dt(item["end"])

    e = Event()
    e.name = f"{item.get('promoter', 'Drift')} - {item['title']}"
    e.begin = start
    e.end = end
    e.location = item.get("location", "")

    e.description = "\n".join([
        f"Promoter: {item.get('promoter', '')}",
        f"Location: {item.get('location', '')}",
        f"Registration / Info: {item.get('url', '')}",
        "",
        item.get("notes", "")
    ])

    if item.get("url"):
        e.url = item["url"]

    cal.events.add(e)

    json_events.append({
        "id": item.get("id", ""),
        "title": item["title"],
        "promoter": item.get("promoter", ""),
        "start": item["start"],
        "end": item["end"],
        "location": item.get("location", ""),
        "url": item.get("url", ""),
        "notes": item.get("notes", "")
    })

json_events.sort(key=lambda x: x["start"])

with open(ICS_OUTPUT, "w", encoding="utf-8") as f:
    f.writelines(cal)

with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
    json.dump(json_events, f, indent=2)
