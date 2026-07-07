import re
import requests
from bs4 import BeautifulSoup

URL = "https://stockton99.com/outlaw-drift"
YEAR = 2026
LOCATION = "San Joaquin County Fairgrounds"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12
}

def clean_day(day):
    return int(re.sub(r"(st|nd|rd|th)", "", day.lower()))

def parse_hour(text):
    match = re.match(r"(\d{1,2})(am|pm)", text.strip().lower())
    hour = int(match.group(1))
    period = match.group(2)

    if period == "pm" and hour != 12:
        hour += 12
    if period == "am" and hour == 12:
        hour = 0

    return hour

def get_events():
    response = requests.get(URL, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n")

    # Page shows one "NEXT DRIFT EVENT" block like:
    # SUNDAY, JULY 26TH
    # OUTLAW DRIFT SERIES PRACTICE DAY - DRIFTING
    # ---
    # ...
    # Event 10am-4pm
    date_match = re.search(
        r"[A-Za-z]+,\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)",
        text,
        re.IGNORECASE
    )

    if not date_match:
        print("Outlaw Drift scraper found 0 events.")
        return []

    month = MONTHS[date_match.group(1).lower()]
    day = clean_day(date_match.group(2))
    date_key = f"{YEAR}-{month:02d}-{day:02d}"

    title_match = re.search(
        r"\d{1,2}(?:st|nd|rd|th)\s*\n+\s*([^\n]+)",
        text,
        re.IGNORECASE
    )
    title = title_match.group(1).strip().title() if title_match else "Outlaw Drift Practice Day"

    time_match = re.search(r"Event\s+(\d{1,2}(?:am|pm))-(\d{1,2}(?:am|pm))", text, re.IGNORECASE)
    start_hour = parse_hour(time_match.group(1)) if time_match else 10
    end_hour = parse_hour(time_match.group(2)) if time_match else 16

    event_id = f"od-{date_key}"

    events = [{
        "id": event_id,
        "title": title,
        "promoter": "Outlaw Drift",
        "start": f"{date_key} {start_hour:02d}:00",
        "end": f"{date_key} {end_hour:02d}:00",
        "location": LOCATION,
        "url": URL,
        "notes": "Auto-imported from Outlaw Drift's Stockton 99 schedule page."
    }]

    print(f"Outlaw Drift scraper found {len(events)} events.")

    return events
