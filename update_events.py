import yaml
from datetime import datetime, timezone
from scrapers import drift_central
from scrapers import bay_area_drifting
from scrapers import fast_in_fast_out
from scrapers import valley_drift_club
from scrapers import outlaw_drift
from scrapers import super_d
from scrapers import apple_valley
from scrapers import nice_tires

EVENTS_FILE = "events.yaml"
MIN_EVENTS_REQUIRED = 1

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
    now = datetime.now(timezone.utc).isoformat()

    for event in incoming:
        event_id = event["id"]

        if event_id not in by_id:
            event = dict(event)
            event["addedAt"] = now
            by_id[event_id] = event
            added += 1
        else:
            # Refresh scraped fields but keep the original addedAt - it
            # marks when the event was first added, not last touched.
            merged_event = dict(event)
            merged_event["addedAt"] = by_id[event_id].get("addedAt", now)
            if by_id[event_id] != merged_event:
                by_id[event_id] = merged_event
                updated += 1

    return list(by_id.values()), added, updated

print("DriftWest auto-updater started.")

existing_events = load_existing_events()
incoming_events = []

drift_central_events = drift_central.get_events()
bay_area_events = bay_area_drifting.get_events()
fifo_events = fast_in_fast_out.get_events()
vdc_events = valley_drift_club.get_events()
outlaw_drift_events = outlaw_drift.get_events()
super_d_events = super_d.get_events()
apple_valley_events = apple_valley.get_events()
nice_tires_events = nice_tires.get_events()

if len(drift_central_events) < MIN_EVENTS_REQUIRED:
    raise RuntimeError(
        "Drift Central scraper found 0 events. "
        "Website structure may have changed. "
        "events.yaml was not modified."
    )

incoming_events.extend(drift_central_events)
incoming_events.extend(bay_area_events)
incoming_events.extend(fifo_events)
incoming_events.extend(vdc_events)
incoming_events.extend(outlaw_drift_events)
incoming_events.extend(super_d_events)
incoming_events.extend(apple_valley_events)
incoming_events.extend(nice_tires_events)

merged_events, added, updated = merge_events(existing_events, incoming_events)

save_events(merged_events)

print(f"Existing events: {len(existing_events)}")
print(f"Incoming events: {len(incoming_events)}")
print(f"Added events: {added}")
print(f"Updated events: {updated}")
print(f"Total events: {len(merged_events)}")
