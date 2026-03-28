# Command Center
### A Claude Code Dashboard by [@tenfoldmarc](https://www.instagram.com/tenfoldmarc)

A local HTML dashboard that gives you a single view of your revenue, emails, calendar, Instagram performance, competitor intel, and AI news. No deployment, no database — just open it in your browser.

Pulls live data through a lightweight Node.js proxy that runs on your machine. Pick which services you want, enter your API keys once, and you're set.

---

## What It Does

1. **Stripe** — Today's revenue, net after fees, refunds, chargebacks, transaction history, and a revenue trend chart. Full date filtering (today, 7d, 30d, custom range).
2. **Gmail** — Priority inbox that filters out noise and surfaces emails that actually need your attention. AI-suggested replies you can edit and send directly from the dashboard.
3. **Google Calendar** — Today's schedule at a glance with a horizontal week view. Create events and invite people without leaving the dashboard.
4. **Instagram** — Your last 25 posts with reach, views, shares, saves, and engagement rate. Visual post cards with metrics overlaid.
5. **Competitor Tracking** — Monitor up to 10 Instagram accounts. See their recent posts, engagement, and outliers. Toggle between your posts and any competitor.
6. **AI News** — Top stories from Twitter/X, Reddit, and Hacker News. Click any story to read the source.

All sections are optional — only enable what you need.

---

## Screenshots

![Command Center Overview](https://via.placeholder.com/800x450?text=Overview+Page)
![Instagram Grid](https://via.placeholder.com/800x450?text=Instagram+Visual+Grid)
![Stripe Dashboard](https://via.placeholder.com/800x450?text=Stripe+Revenue)

---

## Requirements

- A Mac, Linux, or Windows computer
- [Node.js](https://nodejs.org) installed (v18 or higher)
- A modern web browser (Chrome, Firefox, Safari, Edge)

**Optional (depending on which services you enable):**
- A [Stripe](https://dashboard.stripe.com/apikeys) account — for revenue tracking
- A Meta/Instagram Business account + access token — for your post analytics ([generate here](https://developers.facebook.com/tools/explorer/))
- An [Apify](https://apify.com) account (free tier works) — for competitor tracking
- [gws CLI](https://github.com/nicholasgasior/gws) installed + authenticated — for Gmail and Calendar
- A [Tavily](https://tavily.com) account (free tier works) — for AI news

Don't worry about connecting these manually — the setup script walks you through everything.

---

## Install

### Step 1 — Open your terminal

**Mac:** Press `Command + Space`, type **Terminal**, hit Enter.
**Windows:** Press `Win + R`, type **cmd**, hit Enter.
**Linux:** Open your terminal app.

### Step 2 — Clone the repo

Copy-paste this entire line and hit Enter:

```bash
git clone https://github.com/tenfoldmarc/command-center-skill ~/command-center
```

### Step 3 — Run setup

```bash
cd ~/command-center && node setup.js
```

The setup asks which services you want (Stripe, Instagram, competitors, Gmail, AI News), then only asks for the API keys you actually need.

### Step 4 — Start the proxy

```bash
node proxy.js
```

Leave this terminal window open.

### Step 5 — Open the dashboard

Open `dashboard.html` in your browser. On Mac:

```bash
open dashboard.html
```

On Windows/Linux, just double-click the file or drag it into your browser.

---

## Usage

**Daily workflow:**
1. Open a terminal, `cd ~/command-center`, run `node proxy.js`
2. Open `dashboard.html` in your browser
3. Hit the Refresh button (or press `R`) to pull fresh data

**Keyboard shortcuts:**
- `1-6` — Switch between pages
- `T` — Toggle dark/light theme
- `R` — Refresh all data

**Customize the design:**
The entire dashboard is a single HTML file. Edit `dashboard.html` to change colors, fonts, layout, or add new sections. All CSS is embedded — look for the `<style>` block at the top.

---

## Updating

To get the latest version:

```bash
cd ~/command-center && git pull
```

Your `.env` file is gitignored and won't be affected by updates.

---

## File Structure

```
command-center/
├── dashboard.html    # The dashboard (open in browser)
├── proxy.js          # Local proxy server (run with node)
├── setup.js          # Interactive setup wizard
├── .env              # Your API keys (created by setup, gitignored)
├── .gitignore
└── README.md
```

---

## Built By

[@tenfoldmarc](https://www.instagram.com/tenfoldmarc) — Follow for daily AI automation walkthroughs. Real systems, not theory.
