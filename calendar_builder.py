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

    json_event = {
        "id": item.get("id", ""),
        "title": item["title"],
        "promoter": item.get("promoter", ""),
        "start": item["start"],
        "end": item["end"],
        "location": item.get("location", ""),
        "url": item.get("url", ""),
        "notes": item.get("notes", "")
    }
    if item.get("featured"):
        json_event["featured"] = True
    if item.get("featuredNext"):
        json_event["featuredNext"] = True
    if item.get("addedAt"):
        json_event["addedAt"] = item["addedAt"]

    json_events.append(json_event)

json_events.sort(key=lambda x: x["start"])

with open(ICS_OUTPUT, "w", encoding="utf-8") as f:
    f.writelines(cal)

with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
    json.dump(json_events, f, indent=2)

# "Newest" means most recently added to the site, not furthest in the
# future - fall back to list order for any legacy event missing addedAt.
dated_events = [e for e in json_events if e.get("addedAt")]
newest_event = max(dated_events, key=lambda e: e["addedAt"]) if dated_events else (json_events[-1] if json_events else None)

with open("status.json", "w", encoding="utf-8") as f:
    json.dump({
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "newestEvent": newest_event["title"] if newest_event else "No events listed",
        "eventCount": len(json_events),
        "trackCount": len(set(e.get("location", "") for e in json_events if e.get("location"))),
        "promoterCount": len(set(e.get("promoter", "") for e in json_events if e.get("promoter")))
    }, f, indent=2)

print("✅ status.json written successfully")
