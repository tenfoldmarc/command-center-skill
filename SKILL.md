---
name: command-center
description: "Launch your daily command center dashboard — Stripe, Gmail, Calendar, Instagram, competitor tracking, and AI news in one view."
---

# Command Center

When the user runs `/command-center`, follow these steps exactly.

---

## Step 0 — First-Time Setup

Check if the file `~/.claude/skills/command-center/.env` exists.

**If `.env` exists:** Skip to Step 1.

**If `.env` does NOT exist:** Run the interactive setup below.

### Welcome

Say:

```
Welcome to Command Center! Let's get you set up. This takes about 2 minutes and only happens once.

I'll ask which services you want to connect. You can enable as many or as few as you want.
```

### Check Node.js

Run `node --version` via Bash. If it fails, say:

```
Node.js is required but not installed. Download it at https://nodejs.org (v18 or higher), install it, then run /command-center again.
```

Stop here if Node is not installed.

### Ask which services they want

Ask each question one at a time. Wait for their answer before asking the next one.

1. "Do you want **Stripe** — revenue, transactions, refunds, chargebacks?" (y/n)
2. "Do you want **Instagram** — your post performance with reach, views, shares, saves?" (y/n)
3. "Do you want **Competitor Tracking** — monitor other Instagram accounts?" (y/n)
4. "Do you want **Gmail + Calendar** — priority inbox and your daily schedule?" (y/n)
5. "Do you want **AI News** — daily AI stories from Twitter, Reddit, Hacker News?" (y/n)

### Collect API keys (only for services they chose)

For each service they said yes to, ask for the key. Give them the exact URL to get it.

**Stripe:**
```
Get your Stripe Secret Key at: https://dashboard.stripe.com/apikeys
Paste your Secret Key (starts with sk_live_ or sk_test_):
```

**Instagram:**
```
You need a Meta long-lived access token.
Generate one at: https://developers.facebook.com/tools/explorer/
Paste your access token (starts with IGAA or EAA):
```

**Competitor Tracking:**
```
This uses Apify to scrape public Instagram data.
Sign up (free) at: https://apify.com
Go to Settings → Integrations → copy your API token.
Paste your Apify token:
```

Then ask: "Which Instagram handles do you want to track? (comma-separated, no @)"

**Gmail + Calendar:**

Check if `gws` CLI is installed by running `which gws` via Bash.

If installed, run `gws auth status --format json` to check authentication.
- If authenticated: say "Google is connected as [email]."
- If not authenticated: say "Run `gws auth login` in your terminal, then run /command-center again."

If `gws` is NOT installed, say:
```
Gmail + Calendar requires the gws CLI tool.
Install it: brew install gws (Mac) or see https://github.com/nicholasgasior/gws
Then authenticate: gws auth login
Then run /command-center again.
```

**AI News:**
```
This uses Tavily for AI news aggregation.
Sign up (free) at: https://tavily.com
Paste your Tavily API key (starts with tvly-):
```

### Save the .env file

Write the `.env` file to `~/.claude/skills/command-center/.env` using the Write tool. Format:

```
# Command Center Configuration
STRIPE_SECRET_KEY=<their key if provided>
IG_ACCESS_TOKEN=<their token if provided>
APIFY_TOKEN=<their token if provided>
COMPETITORS=<comma-separated handles if provided>
GOOGLE_ENABLED=true (only if gws is authenticated)
USER_EMAIL=<their google email if available>
TAVILY_API_KEY=<their key if provided>
```

Only include lines for services they enabled. Do NOT include lines for services they skipped.

### Confirm setup

Say:

```
Setup complete! Your config is saved.

Enabled: [list their enabled services]

Launching your dashboard now...
```

Then proceed to Step 1.

---

## Step 1 — Launch the Dashboard

The dashboard needs two things running: the proxy server and the HTML file in a browser.

### Start the proxy

Run via Bash (in background):

```bash
cd ~/.claude/skills/command-center && node proxy.js &
```

Wait 2 seconds, then check it started by running:

```bash
curl -s http://localhost:8787/api/health
```

If the health check returns `"status":"ok"`, the proxy is running.

If port 8787 is already in use (from a previous run), kill it first:

```bash
kill $(lsof -ti:8787) 2>/dev/null; sleep 1; cd ~/.claude/skills/command-center && node proxy.js &
```

### Open the dashboard

Run via Bash:

```bash
open ~/.claude/skills/command-center/dashboard.html
```

(On Linux, use `xdg-open` instead of `open`.)

### Confirm

Say:

```
Your Command Center is live!

Dashboard: open in your browser
Proxy: running at http://localhost:8787

Keyboard shortcuts:
  1-6 — Switch pages
  T — Toggle dark/light mode
  R — Refresh all data

To stop the proxy later: kill $(lsof -ti:8787)
```

---

## If the user says "refresh" or "restart"

Kill the existing proxy and relaunch:

```bash
kill $(lsof -ti:8787) 2>/dev/null; sleep 1; cd ~/.claude/skills/command-center && node proxy.js &
```

Then tell them to hit Refresh in the browser (or press R).

---

## If the user says "setup" or "reconfigure"

Delete the existing `.env` file and re-run Step 0:

```bash
rm ~/.claude/skills/command-center/.env
```

Then run through the setup flow again.

---

Built by [@tenfoldmarc](https://instagram.com/tenfoldmarc). Follow for daily AI automation builds — real systems, not theory.
