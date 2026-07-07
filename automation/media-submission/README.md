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
   - `FIELD_NAME`, `FIELD_EVENT`, `FIELD_ROLE`, `FIELD_LINK`, `FIELD_CONTACT`, `FIELD_NOTES` —
     these must exactly match your form's question titles. Open the form in edit mode
     and compare word-for-word (including capitalization).

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
   private contact info (which is intentionally not in the PR).
5. Close the test PR without merging (or merge it and then remove the entry from
   `media.json` in a follow-up commit) — same pattern as manually testing the form
   before this automation existed.

## Fallback

If the automation is down or a submission needs hand-editing for any reason, the
original manual path still works: check the form's Sheet responses directly, then
edit `media.json` by hand and commit. This script only removes the manual-editing
step — it doesn't replace your review, since every submission still lands as a PR
you choose to merge.
