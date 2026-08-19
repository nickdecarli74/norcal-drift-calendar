from datetime import datetime, timedelta
from email.message import EmailMessage
import json
import os
import smtplib

from playwright.sync_api import sync_playwright

# Known Track Database for automatic City/State resolution
TRACK_DATABASE = {
    "apple valley speedway": ("APPLE VALLEY SPEEDWAY", "APPLE VALLEY, CA"),
    "thunderhill raceway park": ("THUNDERHILL RACEWAY PARK", "WILLOWS, CA"),
    "thunderhill": ("THUNDERHILL RACEWAY PARK", "WILLOWS, CA"),
    "qlispe raceway park": ("QLISPE RACEWAY PARK", "AIRWAY HEIGHTS, WA"),
    "affinity circuit": ("AFFINITY CIRCUIT", "CENTRAL POINT, OR"),
    "the mill drift track": ("THE MILL DRIFT TRACK", "SWEET HOME, OR"),
    "musselman honda circuit": ("MUSSELMAN HONDA CIRCUIT", "TUCSON, AZ"),
    "sonoma raceway": ("SONOMA RACEWAY", "SONOMA, CA"),
    "stockton 99 speedway": ("STOCKTON 99 SPEEDWAY", "STOCKTON, CA"),
    "lake county speedway": ("LAKE COUNTY SPEEDWAY", "LAKEPORT, CA"),
    "irwindale speedway": ("IRWINDALE SPEEDWAY", "IRWINDALE, CA"),
    "kern raceway": ("KERN RACEWAY", "BAKERSFIELD, CA"),
    "kern county raceway": ("KERN RACEWAY", "BAKERSFIELD, CA"),
}


def resolve_location(event):
  """Extracts exact Track Name and City, State from event JSON fields."""
  promoter = event.get("promoter", "").strip()
  location = event.get("location", "").strip()
  notes = event.get("notes", "").strip()

  # 1. Search against known track database
  combined_text = f"{promoter} {location} {notes}".lower()
  for key, (track, city_state) in TRACK_DATABASE.items():
    if key in combined_text:
      return track, city_state

  # 2. Handle comma-separated location strings (e.g. "Thunderhill Raceway Park, Willows, CA")
  if "," in location:
    parts = [p.strip() for p in location.split(",")]
    if len(parts) >= 3:
      track = parts[0].upper()
      city_state = f"{parts[1]}, {parts[2]}".upper()
      return track, city_state
    elif len(parts) == 2:
      # Could be "Venue, City ST" or "City, ST"
      return parts[0].upper(), parts[1].upper()

  # 3. Fallback: Use Promoter/Location directly
  track_name = (promoter if promoter else location).upper()
  return track_name, ""


# 1. Load JSON Data
if not os.path.exists("events.json"):
  raise FileNotFoundError("events.json not found in root directory.")

with open("events.json", "r", encoding="utf-8") as f:
  raw_data = json.load(f)

events = (
    raw_data.get("events", raw_data) if isinstance(raw_data, dict) else raw_data
)

# 2. Filter & Expand Multi-Day Events across Friday-Sunday Range
today = datetime.now()
start_offset = 0 if today.weekday() >= 4 else (4 - today.weekday()) % 7
this_friday = (today + timedelta(days=start_offset)).date()
this_sunday = this_friday + timedelta(days=2)

events_by_date = {}

for e in events:
  raw_start = (
      e.get("start") or e.get("date") or e.get("start_date") or e.get("startDate")
  )
  raw_end = e.get("end") or e.get("end_date") or e.get("endDate") or raw_start

  if not raw_start:
    continue

  clean_start_str = raw_start.split(" ")[0].split("T")[0]
  clean_end_str = raw_end.split(" ")[0].split("T")[0] if raw_end else clean_start_str

  try:
    start_dt = datetime.strptime(clean_start_str, "%Y-%m-%d").date()
    end_dt = datetime.strptime(clean_end_str, "%Y-%m-%d").date()
  except ValueError:
    continue

  curr_dt = start_dt
  while curr_dt <= end_dt:
    if this_friday <= curr_dt <= this_sunday:
      if curr_dt not in events_by_date:
        events_by_date[curr_dt] = []

      track_name, city_state = resolve_location(e)
      evt_title = (e.get("title") or e.get("name") or "Drift Event").upper()

      if not any(item["title"] == evt_title for item in events_by_date[curr_dt]):
        events_by_date[curr_dt].append({
            "title": evt_title,
            "day_num": curr_dt.strftime("%d"),
            "day_str": curr_dt.strftime("%a").upper(),
            "track": track_name,
            "city_state": city_state,
        })

    curr_dt += timedelta(days=1)

# 3. Build Formatted HTML Structure
events_html = ""
for d in sorted(events_by_date.keys()):
  group_header = d.strftime("%A, %b %d").upper()

  events_html += f"""
    <div class="date-section">
        <div class="date-header">
            <span>{group_header}</span>
            <div class="date-header-line"></div>
        </div>
    """

  for evt in events_by_date[d]:
    location_display = evt["track"]
    if evt["city_state"]:
      location_display += f"<br>{evt['city_state']}"

    events_html += f"""
        <div class="event-card">
            <div class="date-block">
                <div class="date-num">{evt['day_num']}</div>
                <div class="date-day">{evt['day_str']}</div>
            </div>
            <div class="event-details">
                <div class="event-title">{evt['title']}</div>
                <div class="event-dash"></div>
                <div class="event-venue">{location_display}</div>
            </div>
        </div>
        """

  events_html += "</div>"

if not events_by_date:
  events_html = (
      '<div style="font-size: 28px; color: #808388; font-weight: bold;">NO'
      " EVENTS SCHEDULED THIS WEEKEND</div>"
  )

# 4. Inject into Template
with open("template.html", "r", encoding="utf-8") as f:
  template_code = f.read()

rendered_html = template_code.replace("<!-- EVENTS_PLACEHOLDER -->", events_html)

with open("rendered.html", "w", encoding="utf-8") as f:
  f.write(rendered_html)

# 5. Render Screenshot with Playwright
with sync_playwright() as p:
  browser = p.chromium.launch()
  page = browser.new_page(viewport={"width": 1080, "height": 1350})
  page.goto(f"file://{os.path.abspath('rendered.html')}")
  page.screenshot(path="drift_west_weekend.jpg", type="jpeg", quality=100)
  browser.close()

# 6. Send Email Notification
sender_email = os.environ.get("EMAIL_USER")
sender_password = os.environ.get("EMAIL_PASS")

if sender_email and sender_password:
  msg = EmailMessage()
  msg["Subject"] = f"DriftWest Graphic - {this_friday.strftime('%b %d')}"
  msg["From"] = sender_email
  msg["To"] = "driftwestnet@gmail.com"
  msg.set_content(
      "Attached is your newly generated weekend event schedule graphic."
  )

  with open("drift_west_weekend.jpg", "rb") as f:
    msg.add_attachment(
        f.read(),
        maintype="image",
        subtype="jpeg",
        filename="drift_west_schedule.jpg",
    )

  with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
    server.login(sender_email, sender_password)
    server.send_message(msg)
  print("Graphic generated and email sent successfully!")
else:
  print("Skipped email: EMAIL_USER/EMAIL_PASS not configured.")
