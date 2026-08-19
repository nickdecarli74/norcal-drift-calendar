from datetime import datetime, timedelta
from email.message import EmailMessage
import json
import os
import smtplib

from playwright.sync_api import sync_playwright

# 1. Load JSON (Checks common structures)
if not os.path.exists("events.json"):
    raise FileNotFoundError("events.json not found in root directory.")

with open("events.json", "r", encoding="utf-8") as f:
    raw_data = json.load(f)

events = raw_data.get("events", raw_data) if isinstance(raw_data, dict) else raw_data

# 2. Calculate Weekend Range (Filters from now until Sunday)
today = datetime.now()
# If today is Monday-Thursday, start filter on the coming Friday.
# If today is Friday-Sunday, use today as the start filter.
start_offset = 0 if today.weekday() >= 4 else (4 - today.weekday()) % 7
this_friday = today + timedelta(days=start_offset)
this_sunday = this_friday + timedelta(days=2)

friday_date = this_friday.date()
sunday_date = this_sunday.date()

weekend_events = []
for e in events:
    raw_date_str = (
        e.get("start") or e.get("date") or e.get("start_date") or e.get("startDate")
    )
    if not raw_date_str:
        continue

    # Clean YYYY-MM-DD (stripping times/timeszones)
    clean_date_str = raw_date_str.split(" ")[0].split("T")[0]

    try:
        event_dt = datetime.strptime(clean_date_str, "%Y-%m-%d").date()
        if friday_date <= event_dt <= sunday_date:
            weekend_events.append((e, event_dt))
    except ValueError:
        continue

# 3. Process Location and Group Events by Date
processed_events = []
for e, event_dt in weekend_events:
    # Location Splitting: Tries to split 'Venue, City, ST'
    # Fallback to general location if no comma is found.
    raw_location = e.get("location", "")
    venue = raw_location.strip()
    city_state = ""

    if "," in raw_location:
        loc_parts = raw_location.split(",", 1)
        venue = loc_parts[0].strip()
        city_state = loc_parts[1].strip()

    title = e.get("title") or e.get("name") or "DRift event"
    
    event_data = {
        "id": e.get("id"),
        "date_obj": event_dt,
        "date_num": event_dt.strftime("%d"),
        "day_str": event_dt.strftime("%a").upper(),
        "title": title.upper(),  # Ensure uppercase per design
        "venue": venue.upper(),  # Ensure uppercase per design
        "city_state": city_state.upper()  # Ensure uppercase per design
    }
    processed_events.append(event_data)

# Group events by actual date object
events_by_date = {}
for evt in processed_events:
    d = evt["date_obj"]
    if d not in events_by_date:
        events_by_date[d] = []
    events_by_date[d].append(evt)

# Sort grouped dates
sorted_dates = sorted(events_by_date.keys())

# 4. Generate the Left Column Text Block
month_start_abbr = sorted_dates[0].strftime("%B").upper() if sorted_dates else ""
year_start = sorted_dates[0].strftime("%Y") if sorted_dates else ""

# Calculate Month range: e.g., 'AUGUST 2026' or 'AUGUST/SEPTEMBER 2026'
# (Currently only supports the starting month; expand this as needed)
month_text = f"{month_start_abbr} {year_start}"

# 5. Read HTML Template & Inject Data
if not os.path.exists("template.html"):
    raise FileNotFoundError("template.html not found in root directory.")

with open("template.html", "r", encoding="utf-8") as f:
    html_content = f.read()

# Generate the Left Title Column
left_title_html = f"""
    <div class="col-left">
        <div class="header-prefix">NORCAL DRIFT<br>CALENDAR</div>
        <div class="title-main">
            DRIFT<br>
            EVENTS<br>
            <span class="red-highlight">THIS<br>WEEKEND</span>
        </div>
        <div class="date-range">{month_text}</div>
    </div>
    """

# Generate the Right Events Column, grouped by date
right_events_html = '<div class="col-right">'
for d in sorted_dates:
    group_date_str = d.strftime("%A, %b %d").upper()
    right_events_html += f'<div class="date-separator">{group_date_str}</div>'

    for evt in events_by_date[d]:
        right_events_html += f"""
        <div class="event-card">
            <div class="date-block">
                <div class="date-num">{evt['date_num']}</div>
                <div class="date-day">{evt['day_str']}</div>
            </div>
            <div class="event-details">
                <div class="event-title">{evt['title']}</div>
                <div class="event-location">
                    {evt['venue']}<br>
                    {evt['city_state']}
                </div>
            </div>
        </div>
        """
right_events_html += "</div>"

# Combine columns
final_layout_html = left_title_html + right_events_html

# Inject the generated layout into the template placeholder
final_rendered_html = html_content.replace("<!-- LAYOUT_PLACEHOLDER -->", final_layout_html)

with open("rendered.html", "w", encoding="utf-8") as f:
    f.write(final_rendered_html)

# 6. Render & Screenshot
with sync_playwright() as p:
    # Use standard screen dimensions for 1080x1620 render
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1080, "height": 1620})
    
    # Load from local file
    page.goto(f"file://{os.path.abspath('rendered.html')}")
    
    # Take screenshot as high-quality JPEG
    page.screenshot(path="driftwest_weekend.jpg", type="jpeg", quality=100)
    browser.close()

# 7. Send Email
sender_email = os.environ.get("EMAIL_USER")
sender_password = os.environ.get("EMAIL_PASS")

if not sender_email or not sender_password:
    print("Error: EMAIL_USER or EMAIL_PASS environment secrets are missing.")
else:
    today_formatted = today.strftime("%b %d")
    
    msg = EmailMessage()
    msg["Subject"] = f"DriftWest Weekend Graphic - {today_formatted}"
    msg["From"] = sender_email
    msg["To"] = "driftwestnet@gmail.com" # Target address
    msg.set_content("Attached is this weekend's Instagram event schedule graphic.")

    with open("driftwest_weekend.jpg", "rb") as f:
        msg.add_attachment(
            f.read(),
            maintype="image",
            subtype="jpeg",
            filename=f"driftwest_{today.strftime('%Y%m%d')}.jpg",
        )

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender_email, sender_password)
        server.send_message(msg)

    print("Graphic generated and email sent successfully!")
