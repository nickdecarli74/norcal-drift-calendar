import re
import requests
from bs4 import BeautifulSoup

URL = "https://fastinfastouttrackdays.com/pages/upcoming-events"
YEAR = 2026
LOCATION = "Sonoma Raceway"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12
}

def get_events():
    response = requests.get(URL, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n")

    pattern = re.compile(
        r"\(Drift\s*\).*?([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:-|–)(\d{1,2})(?:st|nd|rd|th)?.*?2026.*?Sonoma",
        re.IGNORECASE | re.DOTALL
    )

    events = []
    seen = set()

    for match in pattern.finditer(text):
        month_name = match.group(1).lower()
        start_day = int(match.group(2))
        end_day = int(match.group(3))
        month = MONTHS[month_name]

        for day in range(start_day, end_day + 1):
            date_key = f"{YEAR}-{month:02d}-{day:02d}"
            event_id = f"fifo-{date_key}"

            if event_id in seen:
                continue

            seen.add(event_id)

            events.append({
                "id": event_id,
                "title": "Fast In Fast Out Drift",
                "promoter": "Fast In Fast Out",
                "start": f"{date_key} 08:00",
                "end": f"{date_key} 18:00",
                "location": LOCATION,
                "url": URL,
                "notes": "Auto-imported from Fast In Fast Out upcoming events."
            })

    print(f"Fast In Fast Out scraper found {len(events)} events.")

    return sorted(events, key=lambda e: e["start"])
