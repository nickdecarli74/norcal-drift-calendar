import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup

URL = "https://bayareadrifting.com/schedule"
YEAR = 2026
LOCATION = "Thunderhill Raceway Park"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12
}

def clean_day(day):
    return int(re.sub(r"(st|nd|rd|th)", "", day.lower()))

def get_events():
    response = requests.get(URL, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n")

    pattern = re.compile(
        r"(Saturday|Sunday)\s+[–-]\s+([A-Za-z]+)\s+(\d{1,2}(?:st|nd|rd|th)?),\s+2026",
        re.IGNORECASE
    )

    events = []
    seen = set()

    for match in pattern.finditer(text):
        weekday = match.group(1).title()
        month_name = match.group(2).lower()
        day = clean_day(match.group(3))
        month = MONTHS[month_name]

        event_id = f"bad-2026-{month:02d}-{day:02d}"

        if event_id in seen:
            continue

        seen.add(event_id)

        events.append({
            "id": event_id,
            "title": "Thunderhill Drift School",
            "promoter": "Bay Area Drifting",
            "start": f"{YEAR}-{month:02d}-{day:02d} 08:00",
            "end": f"{YEAR}-{month:02d}-{day:02d} 17:00",
            "location": LOCATION,
            "url": URL,
            "notes": f"{weekday}. Beginner & Intermediate Drift School. Auto-imported from Bay Area Drifting schedule."
        })

    print(f"Bay Area Drifting scraper found {len(events)} events.")

    return sorted(events, key=lambda e: e["start"])
