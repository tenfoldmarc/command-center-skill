# Command Center
### A Claude Code Dashboard by [@tenfoldmarc](https://www.instagram.com/tenfoldmarc)

A local HTML dashboard that gives you a single view of your revenue, emails, calendar, Instagram performance, competitor intel, and AI news. No deployment, no database — just open it in your browser.

All sections are optional — only enable what you need.

---

## What It Does

1. **Stripe** — Today's revenue, net after fees, refunds, chargebacks, transaction history, and a revenue trend chart. Full date filtering (today, 7d, 30d, custom range).
2. **Gmail** — Priority inbox that filters out noise and surfaces emails that actually need your attention. AI-suggested replies you can edit and send directly from the dashboard.
3. **Google Calendar** — Today's schedule at a glance with a horizontal week view. Create events and invite people without leaving the dashboard.
4. **Instagram** — Your last 25 posts with reach, views, shares, saves, and engagement rate. Visual post cards with metrics overlaid.
5. **Competitor Tracking** — Monitor up to 10 Instagram accounts. See their recent posts, engagement, and outliers. Toggle between your posts and any competitor.
6. **AI News** — Top stories from Twitter/X, Reddit, and Hacker News. Click any story to read the source.

---

## Screenshots

![Command Center Overview](https://via.placeholder.com/800x450?text=Overview+Page)
![Instagram Grid](https://via.placeholder.com/800x450?text=Instagram+Visual+Grid)
![Stripe Dashboard](https://via.placeholder.com/800x450?text=Stripe+Revenue)

---

## Requirements

- A Mac, Linux, or Windows computer
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and working
- [Node.js](https://nodejs.org) installed (v18 or higher)

Don't worry about API keys or accounts — Claude Code walks you through everything on first run.

---

## Install

### Step 1 — Open your terminal

**Mac:** Press `Command + Space`, type **Terminal**, hit Enter.
**Windows:** Press `Win + R`, type **cmd**, hit Enter.
**Linux:** Open your terminal app.

### Step 2 — Copy-paste this and hit Enter

```bash
git clone https://github.com/tenfoldmarc/command-center-skill ~/.claude/skills/command-center
```

Wait for it to finish (takes a few seconds).

### Step 3 — Open Claude Code and type:

```
/command-center
```

That's it. Claude will:
- Ask which services you want to connect (Stripe, Instagram, competitors, Gmail, AI News)
- Only ask for API keys for the ones you chose
- Give you the exact link to get each key
- Save everything securely on your machine
- Launch your dashboard

You never have to touch the terminal setup again.

---

## Daily Usage

Open Claude Code and type:

```
/command-center
```

Claude starts the proxy and opens your dashboard. Or if you prefer doing it manually:

1. Open Terminal
2. `cd ~/.claude/skills/command-center && node proxy.js`
3. Open `dashboard.html` in your browser

**Keyboard shortcuts inside the dashboard:**
- `1-6` — Switch between pages
- `T` — Toggle dark/light mode
- `R` — Refresh all data

---

## Customization

The entire design is in one file: `dashboard.html`. Open it in any text editor to tweak colors, fonts, layout, or add sections. All CSS is embedded in the `<style>` block at the top.

---

## Updating

```bash
cd ~/.claude/skills/command-center && git pull
```

Your `.env` file (API keys) is gitignored and won't be affected.

---

## Reconfigure

To change which services are connected or update your API keys, type in Claude Code:

```
/command-center setup
```

---

## Built By

[@tenfoldmarc](https://www.instagram.com/tenfoldmarc) — Follow for daily AI automation walkthroughs. Real systems, not theory.
