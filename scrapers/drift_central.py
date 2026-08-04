import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup

URL = "https://driftcentral.com/2026-schedule"
REGISTER_URL = "https://driftcentral.com/registration"
YEAR = 2026
LOCATION = "Salinas Municipal Airport"
TITLE = "Drift Central"

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12
}

def make_event_id(month, day):
    return f"dc-{YEAR}-{month:02d}-{day:02d}"

def parse_date_range(date_text):
    date_text = date_text.strip()
    match = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:-(\d{1,2}))?", date_text)

    if not match:
        return []

    month_name = match.group(1).lower()
    start_day = int(match.group(2))
    end_day = int(match.group(3)) if match.group(3) else start_day

    month = MONTHS[month_name]

    return [(month, day) for day in range(start_day, end_day + 1)]

def get_events():
    response = requests.get(URL, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n")

    # Drift Central schedule uses chunks like:
    # Mar 7-8
    # 2 Drift Event
    # 7am
    # -
    # 5pm
    # Salinas Municipal Airport
    pattern = re.compile(
        r"([A-Z][a-z]{2,8}\s+\d{1,2}(?:-\d{1,2})?)\s+"
        r"(.{0,40}?Drift Event)",
        re.IGNORECASE
    )

    events = []
    seen_ids = set()

    for match in pattern.finditer(text):
        date_text = match.group(1)

        dates = parse_date_range(date_text)

        for month, day in dates:
            event_id = make_event_id(month, day)

            if event_id in seen_ids:
                continue

            seen_ids.add(event_id)

            events.append({
                "id": event_id,
                "title": TITLE,
                "promoter": "Drift Central",
                "start": f"{YEAR}-{month:02d}-{day:02d} 07:00",
                "end": f"{YEAR}-{month:02d}-{day:02d} 17:00",
                "location": LOCATION,
                "url": REGISTER_URL,
                "notes": "Auto-imported from Drift Central schedule."
            })

    print(f"Drift Central scraper found {len(events)} events.")

    return sorted(events, key=lambda e: e["start"])
