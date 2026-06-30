import yaml
from scrapers import drift_central

EVENTS_FILE = "events.yaml"

def load_existing_events():
    with open(EVENTS_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("events", [])

def save_events(events):
    events = sorted(events, key=lambda e: e["start"])
    with open(EVENTS_FILE, "w", encoding="utf-8") as f:
        yaml.safe_dump(
            {"events": events},
            f,
            sort_keys=False,
            allow_unicode=True
        )

def merge_events(existing, incoming):
    by_id = {event["id"]: event for event in existing if event.get("id")}

    added = 0
    updated = 0

    for event in incoming:
        event_id = event["id"]

        if event_id not in by_id:
            by_id[event_id] = event
            added += 1
        elif by_id[event_id] != event:
            by_id[event_id] = event
            updated += 1

    return list(by_id.values()), added, updated

print("DriftCal auto-updater started.")

existing_events = load_existing_events()
incoming_events = []

incoming_events.extend(drift_central.get_events())

merged_events, added, updated = merge_events(existing_events, incoming_events)

save_events(merged_events)

print(f"Existing events: {len(existing_events)}")
print(f"Incoming events: {len(incoming_events)}")
print(f"Added events: {added}")
print(f"Updated events: {updated}")
print(f"Total events: {len(merged_events)}")
