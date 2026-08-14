import re
from datetime import datetime, timedelta
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

    days = []
    seen_dates = set()

    for match in pattern.finditer(text):
        weekday = match.group(1).title()
        month_name = match.group(2).lower()
        day = clean_day(match.group(3))
        month = MONTHS[month_name]
        date_key = f"{YEAR}-{month:02d}-{day:02d}"

        if date_key in seen_dates:
            continue

        seen_dates.add(date_key)
        days.append((date_key, weekday))

    days.sort(key=lambda d: d[0])

    # A Saturday immediately followed by its Sunday is one weekend school,
    # not two separate events - merge them into a single event spanning
    # both days so they share one media page.
    events = []
    i = 0
    while i < len(days):
        date_key, weekday = days[i]
        this_date = datetime.strptime(date_key, "%Y-%m-%d")

        if weekday == "Saturday" and i + 1 < len(days):
            next_date_key, next_weekday = days[i + 1]
            next_date = datetime.strptime(next_date_key, "%Y-%m-%d")

            if next_weekday == "Sunday" and next_date - this_date == timedelta(days=1):
                events.append({
                    "id": f"bad-{date_key}",
                    "title": "Thunderhill Drift School",
                    "promoter": "Bay Area Drifting",
                    "start": f"{date_key} 08:00",
                    "end": f"{next_date_key} 17:00",
                    "location": LOCATION,
                    "url": URL,
                    "notes": "Weekend. Beginner & Intermediate Drift School. Auto-imported from Bay Area Drifting schedule."
                })
                i += 2
                continue

        events.append({
            "id": f"bad-{date_key}",
            "title": "Thunderhill Drift School",
            "promoter": "Bay Area Drifting",
            "start": f"{date_key} 08:00",
            "end": f"{date_key} 17:00",
            "location": LOCATION,
            "url": URL,
            "notes": f"{weekday}. Beginner & Intermediate Drift School. Auto-imported from Bay Area Drifting schedule."
        })
        i += 1

    print(f"Bay Area Drifting scraper found {len(events)} events.")

    return sorted(events, key=lambda e: e["start"])
