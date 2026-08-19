from datetime import datetime, timedelta
from email.message import EmailMessage
import json
import os
import smtplib

from playwright.sync_api import sync_playwright

# 1. Load JSON
if not os.path.exists("events.json"):
  raise FileNotFoundError("events.json not found in root directory.")

with open("events.json", "r") as f:
  raw_data = json.load(f)

events = (
    raw_data.get("events", raw_data) if isinstance(raw_data, dict) else raw_data
)

# 2. Calculate Weekend Range (Fri - Sun)
today = datetime.now()
this_friday = today + timedelta(days=(4 - today.weekday()) % 7)
this_sunday = this_friday + timedelta(days=2)

friday_date = this_friday.date()
sunday_date = this_sunday.date()

weekend_events = []
for e in events:
  # Check start, date, or start_date
  raw_date_str = (
      e.get("start") or e.get("date") or e.get("start_date") or e.get("startDate")
  )
  if not raw_date_str:
    continue

  # Extract YYYY-MM-DD regardless of timestamp hours
  clean_date_str = raw_date_str.split(" ")[0].split("T")[0]

  try:
    event_dt = datetime.strptime(clean_date_str, "%Y-%m-%d").date()
    if friday_date <= event_dt <= sunday_date:
      weekend_events.append((e, event_dt))
  except ValueError:
    continue

print(
    f"Found {len(weekend_events)} events for weekend {friday_date} to"
    f" {sunday_date}."
)

# 3. Read HTML Template & Inject Data
if not os.path.exists("template.html"):
  raise FileNotFoundError("template.html not found in root directory.")

with open("template.html", "r") as f:
  html_content = f.read()

events_html = ""
for e, event_dt in weekend_events:
  title = e.get("title") or e.get("name") or "Drift Event"
  location = e.get("location") or e.get("promoter") or ""
  day_num = event_dt.strftime("%d")
  day_str = event_dt.strftime("%a").upper()

  events_html += f"""
    <div class="event-card">
      <div class="date-num">{day_num}<br><span style="font-size:16px;">{day_str}</span></div>
      <div>
        <div style="font-weight:bold; font-size:24px;">{title}</div>
        <div class="accent-line"></div>
        <div class="sub-text">{location}</div>
      </div>
    </div>
    """

if not weekend_events:
  events_html = (
      '<div style="font-size: 24px; color: #8A8A8A;">NO EVENTS SCHEDULED THIS'
      " WEEKEND</div>"
  )

html_content = html_content.replace("<!-- EVENTS_PLACEHOLDER -->", events_html)

with open("rendered.html", "w") as f:
  f.write(html_content)

# 4. Render & Screenshot
with sync_playwright() as p:
  browser = p.chromium.launch()
  page = browser.new_page(viewport={"width": 1080, "height": 1620})
  page.goto(f"file://{os.path.abspath('rendered.html')}")
  page.screenshot(path="drift_west_weekend.jpg", type="jpeg", quality=100)
  browser.close()

# 5. Send Email
sender_email = os.environ.get("EMAIL_USER")
sender_password = os.environ.get("EMAIL_PASS")

if not sender_email or not sender_password:
  raise ValueError(
      "EMAIL_USER or EMAIL_PASS environment secrets are missing."
  )

msg = EmailMessage()
msg["Subject"] = f"DriftWest Graphic - {this_friday.strftime('%b %d')}"
msg["From"] = sender_email
msg["To"] = "driftwestnet@gmail.com"
msg.set_content("Attached is this weekend's Instagram event schedule graphic.")

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
