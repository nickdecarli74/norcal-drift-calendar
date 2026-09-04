# Media submission automation setup

`Code.gs` in this folder is a Google Apps Script that turns a form response into
a GitHub pull request against `media.json`. It's meant to be pasted into an Apps
Script project bound to the Google Sheet the form writes to. This file has the
one-time setup steps — Claude Code can't do these, since they require your Google
and GitHub accounts.

## 1. Create a GitHub token

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
2. Repository access: only `norcal-drift-calendar`.
3. Permissions: **Contents** → Read and write, **Pull requests** → Read and write. Nothing else.
4. Copy the token — you'll paste it into Apps Script, not into any file in this repo.

## 2. Add the script to the form's Sheet

1. Open the Google Form's linked response Sheet → **Extensions → Apps Script**.
2. Delete the placeholder `Code.gs` content and paste in this folder's `Code.gs`.
3. At the top of the file, check the constants match reality:
   - `GITHUB_OWNER` / `GITHUB_REPO` — should already be correct.
   - `OWNER_EMAIL` — where submission/failure notifications go.
   - `FIELD_NAME`, `FIELD_EVENT`, `FIELD_ROLE`, `FIELD_LINK`, `FIELD_CONTACT`, `FIELD_FEATURED` —
     these must exactly match your form's question titles. Open the form in edit mode
     and compare word-for-word (including capitalization). Missing this step is exactly
     how a past field swap here went unnoticed for a long time: the field was silently
     empty on every submission with no error anywhere.

## 3. Store the GitHub token

1. In the Apps Script editor: **Project Settings** (gear icon) → **Script Properties** → **Add script property**.
2. Property: `GITHUB_TOKEN`. Value: the token from step 1.
3. Never paste the token directly into `Code.gs`.

## 4. Create the trigger

1. In the Apps Script editor: **Triggers** (clock icon) → **Add Trigger**.
2. Function: `onFormSubmit`. Event source: **From spreadsheet** or **From form** —
   whichever this project is bound to (depends on whether you opened Apps Script from
   the form's response Sheet or the Form itself). `Code.gs` handles both event shapes
   via `extractNamedValues_`, so either works. Event type: **On form submit**.
3. Save — you'll be prompted to authorize the script (it needs permission to make
   external requests and send email on your behalf). You'll likely see an
   "unverified app" warning first since this is a personal script, not a published
   one — click **Advanced** → **Go to \<project name\> (unsafe)** → **Allow**. This is
   expected and safe since you're both the developer and the user.

## 5. How the "Event" dropdown gets matched

The script doesn't require a rigid dropdown format. It fetches `events.json` and, for
each event, checks whether the submitted answer contains **both**: the event's date
(tried in a few common formats) **and** the event's title or promoter name, somewhere
in the text. So `"Valley Drift Club - July 11, 2026"` matches fine, and so would
`"Jul 11 2026 — VDC"` as long as "VDC" isn't how you'd write "Valley Drift Club" (it
needs the actual promoter/title text, not an abbreviation the script doesn't know).

Whenever a new event needs to be selectable in the form, just add a dropdown option
that includes that event's promoter (or title) plus its date, in whatever readable
format you'd naturally write — no special syntax needed. This is already a manual step
today (the dropdown doesn't update itself).

If the script can't find exactly one matching event (none, or an ambiguous multiple
match), it emails you the raw submission instead of silently failing or guessing.

## 6. Test it

1. Submit a real test entry through the live form (pick an existing event, any role,
   any link).
2. In the Apps Script editor, check **Executions** (left sidebar) — confirm the run
   succeeded with no errors.
3. Check GitHub for a new PR titled `Media submission: <name> (<eventId>)`. The PR
   should only touch `media.json` and add exactly one submission.
4. Check your email for the notification — it should include the link, role, and the
   Contact field's value. If Contact looks like an email it stays private (not in the
   PR); if it looks like an Instagram handle instead, it's pulled into the PR as the
   submission's `instagram` field (public, since that's the point of the media page) —
   the email tells you which happened.
5. Close the test PR without merging (or merge it and then remove the entry from
   `media.json` in a follow-up commit) — same pattern as manually testing the form
   before this automation existed.

## 7. Deploy the on-site submission Web app

`media.html` shows a custom-styled submission form (built in `media.js`, see
`mediaSubmitFormHtml()` / `wireMediaSubmitForm()`) instead of linking straight to
the Google Form. It remembers a returning submitter's Name/Handle, Role, and
Contact in the browser's `localStorage` so repeat photographers just paste their
event link and hit submit.

It does **not** submit through the Google Form. An earlier version tried
POSTing straight into the Form's `/formResponse` endpoint (the classic
custom-Google-Form-UI trick), but Google enforces the Event question's dropdown
option list server-side and silently rejects any value that isn't an exact
existing option — confirmed by testing, since the on-site form necessarily
generates its own event text rather than picking from that hand-maintained
list. Instead, the on-site form POSTs JSON directly to `doPost(e)` in this same
`Code.gs`, which opens the PR itself using the exact `eventId` the page already
knows — no Google Form, Sheet, or fuzzy event-matching involved for this path.

This needs its own deployment, separate from the trigger in step 4:

1. In the same Apps Script project: **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Execute as: **Me**. Who has access: **Anyone**.
4. Deploy — you'll likely see the same "unverified app" authorization prompt as
   step 4; click through it the same way.
5. Copy the **Web app URL** (ends in `/exec`).
6. Paste that URL into `MEDIA_SUBMIT_WEBAPP_URL` at the top of `media.js`,
   replacing the empty string. Until this is filled in, `media.js` deliberately
   hides the custom form and shows only the "use the form directly" link to the
   real Google Form — so visitors never see a false "submitted" message for a
   submission that has nowhere to go.

**IMPORTANT — this is the deployment-equivalent of the entry-ID/field-name sync
problem above**: editing `Code.gs` in the Apps Script editor does *not* update
an already-deployed Web app. The `/exec` URL keeps running whatever code was
live at its last deployed version. Whenever you change `Code.gs`, go to
**Deploy → Manage deployments**, click the pencil icon on the existing Web app
deployment, set **Version: New version**, and deploy again — otherwise your
change silently never takes effect for on-site submissions, with no error
anywhere to tell you.

Test it similarly to step 6, but note this path never touches the Sheet at
all — `doPost` opens the GitHub PR directly. Submit through the on-site form on
a real event's `media.html` page, confirm a new PR appears titled
`Media submission: <name> (<eventId>)`, and confirm you got the owner
notification email, then close the test PR without merging.

## Fallback

If the automation is down or a submission needs hand-editing for any reason, the
original manual path still works: check the form's Sheet responses directly, then
edit `media.json` by hand and commit. This script only removes the manual-editing
step — it doesn't replace your review, since every submission still lands as a PR
you choose to merge.
