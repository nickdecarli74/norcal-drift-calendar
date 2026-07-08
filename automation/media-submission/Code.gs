/**
 * DriftWest media submission automation.
 *
 * Bound to the Google Sheet that collects responses from the "SHOT THIS EVENT?"
 * form. An installable "On form submit" trigger calls onFormSubmit(e) below,
 * which resolves the submitted event to a media.json eventId, opens a PR against
 * the DriftWest GitHub repo with the new submission, and emails the owner a
 * summary (including the private Contact field, which never goes in the PR).
 *
 * Setup: see README.md in this same folder. Do not hardcode the GitHub token —
 * it's read from Script Properties (GITHUB_TOKEN) at runtime.
 */

// ---- Config ----

const GITHUB_OWNER = "nickdecarli74";
const GITHUB_REPO = "norcal-drift-calendar";
const BASE_BRANCH = "main";
const OWNER_EMAIL = "nickdecarli74@gmail.com";

// Must match the exact question titles in the Google Form.
const FIELD_NAME = "Name/Handle";
const FIELD_EVENT = "Event";
const FIELD_ROLE = "Role";
const FIELD_LINK = "Link to your album, reel or channel";
const FIELD_CONTACT = "Your Email or Instagram handle (so we can reach you if needed)";
const FIELD_NOTES = "Anything else we should know?";

// ---- Entry point ----

function onFormSubmit(e) {
  var raw = null;
  try {
    raw = extractNamedValues_(e);
    if (!raw) throw new Error("No form data on trigger event.");

    var name = firstValue_(raw, FIELD_NAME);
    var eventAnswer = firstValue_(raw, FIELD_EVENT);
    var roleAnswer = firstValue_(raw, FIELD_ROLE);
    var link = firstValue_(raw, FIELD_LINK);
    var contact = firstValue_(raw, FIELD_CONTACT);
    var notes = firstValue_(raw, FIELD_NOTES);

    if (!name || !eventAnswer || !roleAnswer || !link) {
      throw new Error("Missing a required field (name/event/role/link).");
    }

    var eventId = resolveEventId_(eventAnswer);
    if (!eventId) {
      throw new Error(
        "Could not match event answer to an eventId: \"" + eventAnswer + "\""
      );
    }

    var role = mapRole_(roleAnswer);
    var submission = { name: name, role: role, url: link };
    if (notes) submission.note = notes;

    var token = getGithubToken_();
    var branch = "media-submission-" + Utilities.formatDate(
      new Date(), "UTC", "yyyyMMdd-HHmmss"
    );

    var baseSha = getBranchHeadSha_(token, BASE_BRANCH);
    createBranch_(token, branch, baseSha);

    var file = getFileOnBranch_(token, "media.json", branch);
    var mediaData = JSON.parse(file.content);
    var updated = addSubmission_(mediaData, eventId, submission);
    var newContent = JSON.stringify(updated, null, 2) + "\n";

    commitFile_(
      token,
      "media.json",
      newContent,
      file.sha,
      branch,
      "Add media submission: " + name + " (" + role + ") for " + eventId
    );

    var prUrl = openPullRequest_(token, branch, name, role, eventId);

    sendOwnerEmail_(prUrl, {
      name: name, role: role, link: link, note: notes,
      contact: contact, eventId: eventId, eventAnswer: eventAnswer
    });
  } catch (err) {
    sendAlertEmail_(err, raw);
  }
}

// ---- Field helpers ----

// Normalizes the two different trigger event shapes Apps Script can hand us:
// a form-bound "On form submit" trigger gives e.response (a FormResponse),
// while a spreadsheet-bound one gives e.namedValues (question title -> [answer]).
// Returns the namedValues shape either way so the rest of the script doesn't care
// which container the script ended up bound to.
function extractNamedValues_(e) {
  if (e && e.response) {
    var map = {};
    e.response.getItemResponses().forEach(function (ir) {
      map[ir.getItem().getTitle()] = [String(ir.getResponse())];
    });
    return map;
  }
  if (e && e.namedValues) return e.namedValues;
  return null;
}

function firstValue_(namedValues, field) {
  var arr = namedValues[field];
  return arr && arr.length ? String(arr[0]).trim() : "";
}

function mapRole_(answer) {
  var norm = (answer || "").trim().toLowerCase();
  if (norm.indexOf("driver") !== -1) return "driver";
  if (norm.indexOf("both") !== -1) return "both";
  if (norm.indexOf("video") !== -1) return "video";
  if (norm.indexOf("photo") !== -1) return "photo";
  // Fall through: treat unrecognized answers as photo rather than dropping the submission.
  return "photo";
}

// ---- Event matching ----

// Fuzzy on purpose: the Google Form's "Event" dropdown is free-text edited by the
// owner and its exact wording can drift (dashes, month format, whether it includes
// the title vs. just the promoter). Rather than requiring the dropdown to follow a
// rigid convention, we check whether the event's date AND its title-or-promoter both
// appear somewhere in the answer. If that's ambiguous (0 or 2+ matches), we bail out
// to the failure email rather than guess.
function resolveEventId_(eventAnswer) {
  var url = "https://raw.githubusercontent.com/" + GITHUB_OWNER + "/" +
    GITHUB_REPO + "/" + BASE_BRANCH + "/events.json";
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Failed to fetch events.json: " + resp.getContentText());
  }
  var events = JSON.parse(resp.getContentText());
  var answer = (eventAnswer || "").trim().toLowerCase();

  var matches = events.filter(function (ev) {
    var d = new Date(ev.start.replace(" ", "T"));
    var dateVariants = [
      Utilities.formatDate(d, "America/Los_Angeles", "yyyy-MM-dd"),
      Utilities.formatDate(d, "America/Los_Angeles", "MMMM d, yyyy"),
      Utilities.formatDate(d, "America/Los_Angeles", "MMM d, yyyy"),
      Utilities.formatDate(d, "America/Los_Angeles", "M/d/yyyy")
    ].map(function (s) { return s.toLowerCase(); });

    var hasDate = dateVariants.some(function (dv) {
      return answer.indexOf(dv) !== -1;
    });
    var hasName = answer.indexOf(ev.title.toLowerCase()) !== -1 ||
      answer.indexOf(ev.promoter.toLowerCase()) !== -1;

    return hasDate && hasName;
  });

  return matches.length === 1 ? matches[0].id : null;
}

// ---- GitHub REST helpers ----

function getGithubToken_() {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN script property is not set.");
  return token;
}

function githubFetch_(token, path, options) {
  var url = "https://api.github.com" + path;
  var opts = Object.assign({
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    muteHttpExceptions: true
  }, options || {});
  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(
      "GitHub API " + (options && options.method || "get") + " " + path +
      " failed (" + code + "): " + resp.getContentText()
    );
  }
  return JSON.parse(resp.getContentText());
}

function getBranchHeadSha_(token, branch) {
  var ref = githubFetch_(
    token,
    "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/git/ref/heads/" + branch
  );
  return ref.object.sha;
}

function createBranch_(token, branch, baseSha) {
  githubFetch_(
    token,
    "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/git/refs",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ ref: "refs/heads/" + branch, sha: baseSha })
    }
  );
}

function getFileOnBranch_(token, path, branch) {
  var data = githubFetch_(
    token,
    "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + path +
      "?ref=" + encodeURIComponent(branch)
  );
  var bytes = Utilities.base64Decode(data.content, Utilities.Charset.UTF_8);
  var content = Utilities.newBlob(bytes).getDataAsString("UTF-8");
  return { content: content, sha: data.sha };
}

function commitFile_(token, path, newContent, sha, branch, message) {
  var encoded = Utilities.base64Encode(newContent, Utilities.Charset.UTF_8);
  githubFetch_(
    token,
    "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + path,
    {
      method: "put",
      contentType: "application/json",
      payload: JSON.stringify({
        message: message,
        content: encoded,
        sha: sha,
        branch: branch
      })
    }
  );
}

function openPullRequest_(token, branch, name, role, eventId) {
  var body = [
    "Automated media submission from the DriftWest form.",
    "",
    "- **Name/handle:** " + name,
    "- **Role:** " + role,
    "- **Event:** " + eventId,
    "",
    "Contact info was emailed to the site owner separately and is not included here."
  ].join("\n");

  var pr = githubFetch_(
    token,
    "/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/pulls",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        title: "Media submission: " + name + " (" + eventId + ")",
        head: branch,
        base: BASE_BRANCH,
        body: body
      })
    }
  );
  return pr.html_url;
}

// ---- media.json editing ----

function addSubmission_(mediaData, eventId, submission) {
  var entry = null;
  for (var i = 0; i < mediaData.length; i++) {
    if (mediaData[i].eventId === eventId) { entry = mediaData[i]; break; }
  }
  if (!entry) {
    entry = { eventId: eventId, submissions: [] };
    mediaData.push(entry);
  }
  entry.submissions.push(submission);
  return mediaData;
}

// ---- Notifications ----

function sendOwnerEmail_(prUrl, s) {
  var lines = [
    "New media submission ready for review:",
    "",
    "PR: " + prUrl,
    "Event: " + s.eventId + " (matched from \"" + s.eventAnswer + "\")",
    "Name/handle: " + s.name,
    "Role: " + s.role,
    "Link: " + s.link,
    s.note ? "Note: " + s.note : null,
    "",
    "Contact (not in the PR): " + (s.contact || "(not provided)")
  ].filter(function (l) { return l !== null; }).join("\n");

  MailApp.sendEmail(OWNER_EMAIL, "DriftWest media submission: " + s.name, lines);
}

function sendAlertEmail_(err, raw) {
  var body = "The media submission automation failed.\n\n" +
    "Error: " + (err && err.message ? err.message : err) + "\n\n" +
    "Raw form data:\n" + JSON.stringify(raw, null, 2);
  try {
    MailApp.sendEmail(OWNER_EMAIL, "DriftWest media submission FAILED", body);
  } catch (mailErr) {
    // If email itself fails, the Apps Script execution log is the last resort.
    console.error(body);
  }
}
