import json
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from playwright.sync_api import sync_playwright
import os

# 1. Read local JSON directly
with open("events.json", "r") as f:
    events = json.load(f)

# 2. Filter for upcoming Friday - Sunday
today = datetime.now()
this_friday = today + timedelta(days=(4 - today.weekday()) % 7)
this_sunday = this_friday + timedelta(days=2)

weekend_events = [
    e for e in events 
    if this_friday.strftime('%Y-%m-%d') <= e.get('date', '') <= this_sunday.strftime('%Y-%m-%d')
]

# 3. Read HTML Template & Inject Data
with open("template.html", "r") as f:
    html_content = f.read()

events_html = ""
for e in weekend_events:
    events_html += f"""
    <div class="event-card">
      <div class="date-num">{e.get('day_num', '')}<br><span style="font-size:16px;">{e.get('day_str', '')}</span></div>
      <div>
        <div style="font-weight:bold; font-size:24px;">{e.get('title', '')}</div>
        <div class="accent-line"></div>
        <div class="sub-text">{e.get('location', '')}</div>
      </div>
    </div>
    """

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
sender_email = os.environ["EMAIL_USER"]
sender_password = os.environ["EMAIL_PASS"]

msg = EmailMessage()
msg["Subject"] = f"DriftWest Graphic - {this_friday.strftime('%b %d')}"
msg["From"] = sender_email
msg["To"] = "driftwestnet@gmail.com"
msg.set_content("Attached is this weekend's Instagram event schedule graphic.")

with open("drift_west_weekend.jpg", "rb") as f:
    msg.add_attachment(f.read(), maintype="image", subtype="jpeg", filename="drift_west_schedule.jpg")

with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
    server.login(sender_email, sender_password)
    server.send_message(msg)
