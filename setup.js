#!/usr/bin/env node

/**
 * COMMAND CENTER — Interactive Setup
 *
 * Walks you through which services to enable and collects API keys.
 * Saves everything to a local .env file that the proxy reads.
 *
 * Run: node setup.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function yn(question) {
  return new Promise(resolve => {
    rl.question(question + ' (y/n): ', answer => {
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║        COMMAND CENTER — Setup            ║
║                                          ║
║  Your daily dashboard for revenue,       ║
║  email, calendar, content & AI news.     ║
╚══════════════════════════════════════════╝
`);

  // Check if .env already exists
  if (fs.existsSync(ENV_PATH)) {
    const overwrite = await yn('A .env file already exists. Overwrite it?');
    if (!overwrite) {
      console.log('\nSetup cancelled. Your existing config is untouched.');
      rl.close();
      return;
    }
  }

  const config = {};

  console.log('I\'ll ask which services you want to enable, then only ask for the keys you need.\n');

  // ── SERVICE SELECTION ──────────────────────
  console.log('─── Which services do you want? ───\n');

  const wantStripe = await yn('1. Stripe — revenue, transactions, refunds');
  const wantInstagram = await yn('2. Instagram — your post performance (reach, views, shares, saves)');
  const wantCompetitors = await yn('3. Competitor tracking — monitor other Instagram accounts');
  const wantGoogle = await yn('4. Gmail + Calendar — priority inbox and schedule');
  const wantNews = await yn('5. AI News — daily AI stories from Twitter, Reddit, Hacker News');

  console.log('');

  // ── COLLECT KEYS ───────────────────────────

  // Stripe
  if (wantStripe) {
    console.log('─── Stripe ───');
    console.log('Get your Secret Key at: https://dashboard.stripe.com/apikeys\n');
    config.STRIPE_SECRET_KEY = await ask('Stripe Secret Key (sk_live_... or sk_test_...): ');
    console.log('');
  }

  // Instagram
  if (wantInstagram) {
    console.log('─── Instagram ───');
    console.log('You need a Meta long-lived access token and your Instagram Business Account ID.');
    console.log('Generate at: https://developers.facebook.com/tools/explorer/\n');
    config.IG_ACCESS_TOKEN = await ask('Meta Access Token (starts with IGAA... or EAA...): ');
    console.log('');
  }

  // Competitors
  if (wantCompetitors) {
    console.log('─── Competitor Tracking ───');
    console.log('Uses Apify to scrape public Instagram data.');
    console.log('Get your API token at: https://console.apify.com/account/integrations\n');
    config.APIFY_TOKEN = await ask('Apify API Token: ');
    console.log('');
    const handles = await ask('Instagram handles to track (comma-separated, no @): ');
    config.COMPETITORS = handles.split(',').map(h => h.trim()).filter(Boolean).join(',');
    console.log('');
  }

  // Google (Gmail + Calendar)
  if (wantGoogle) {
    console.log('─── Gmail + Calendar ───');
    console.log('This uses the gws CLI tool for Google Workspace access.');
    console.log('');

    // Check if gws is installed
    let gwsInstalled = false;
    try {
      require('child_process').execSync('which gws', { stdio: 'pipe' });
      gwsInstalled = true;
    } catch {}

    if (gwsInstalled) {
      console.log('✓ gws CLI is installed.\n');

      // Check if authenticated
      try {
        const status = require('child_process').execSync('gws auth status --format json 2>/dev/null', { encoding: 'utf8' });
        const parsed = JSON.parse(status);
        if (parsed.token_valid) {
          console.log(`✓ Authenticated as: ${parsed.user || 'unknown'}\n`);
          config.GOOGLE_ENABLED = 'true';
          config.USER_EMAIL = parsed.user || '';
        } else {
          console.log('⚠ gws is installed but not authenticated.');
          console.log('Run this in your terminal: gws auth login');
          console.log('Then re-run this setup.\n');
        }
      } catch {
        console.log('⚠ Could not check gws auth status.');
        console.log('Run: gws auth login\n');
      }
    } else {
      console.log('⚠ gws CLI is not installed.');
      console.log('Install it: brew install gws');
      console.log('Then authenticate: gws auth login');
      console.log('Then re-run this setup.\n');
    }
  }

  // AI News
  if (wantNews) {
    console.log('─── AI News ───');
    console.log('Uses Tavily for AI news aggregation.');
    console.log('Get your API key at: https://tavily.com (free tier works)\n');
    config.TAVILY_API_KEY = await ask('Tavily API Key (tvly-...): ');
    console.log('');
  }

  // ── WRITE .env ─────────────────────────────
  let envContent = '# Command Center Configuration\n';
  envContent += '# Generated by setup.js — edit this file to update your keys\n\n';

  if (config.STRIPE_SECRET_KEY) envContent += `STRIPE_SECRET_KEY=${config.STRIPE_SECRET_KEY}\n`;
  if (config.IG_ACCESS_TOKEN) envContent += `IG_ACCESS_TOKEN=${config.IG_ACCESS_TOKEN}\n`;
  if (config.APIFY_TOKEN) envContent += `APIFY_TOKEN=${config.APIFY_TOKEN}\n`;
  if (config.COMPETITORS) envContent += `COMPETITORS=${config.COMPETITORS}\n`;
  if (config.GOOGLE_ENABLED) envContent += `GOOGLE_ENABLED=true\n`;
  if (config.USER_EMAIL) envContent += `USER_EMAIL=${config.USER_EMAIL}\n`;
  if (config.TAVILY_API_KEY) envContent += `TAVILY_API_KEY=${config.TAVILY_API_KEY}\n`;

  fs.writeFileSync(ENV_PATH, envContent);

  // ── DONE ───────────────────────────────────
  const enabled = [];
  if (config.STRIPE_SECRET_KEY) enabled.push('Stripe');
  if (config.IG_ACCESS_TOKEN) enabled.push('Instagram');
  if (config.APIFY_TOKEN) enabled.push('Competitors');
  if (config.GOOGLE_ENABLED) enabled.push('Gmail + Calendar');
  if (config.TAVILY_API_KEY) enabled.push('AI News');

  console.log('══════════════════════════════════════════');
  console.log('  Setup complete!');
  console.log('');
  console.log('  Enabled: ' + (enabled.length ? enabled.join(', ') : 'None'));
  console.log('  Config saved to: .env');
  console.log('');
  console.log('  To start your dashboard:');
  console.log('    1. node proxy.js');
  console.log('    2. Open dashboard.html in your browser');
  console.log('');
  console.log('  To change your config later, edit .env or re-run:');
  console.log('    node setup.js');
  console.log('══════════════════════════════════════════');

  rl.close();
}

main().catch(e => { console.error(e); rl.close(); });
