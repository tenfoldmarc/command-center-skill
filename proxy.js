/**
 * COMMAND CENTER PROXY
 *
 * Reads API keys from .env file in this directory.
 * Uses gws CLI for Gmail & Calendar (optional).
 *
 * Run: node proxy.js
 * Dashboard: open dashboard.html in your browser
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8787;
const DIR = __dirname;

/* ============================================
   LOAD KEYS FROM .env
   ============================================ */
function loadEnv() {
  const envPath = path.join(DIR, '.env');
  const keys = {};

  if (!fs.existsSync(envPath)) {
    console.error('\n⚠ No .env file found. Run the setup first:\n  node setup.js\n');
    process.exit(1);
  }

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (val) keys[key] = val;
  }

  return keys;
}

const ENV = loadEnv();

// Determine which services are enabled
const SERVICES = {
  stripe: !!ENV.STRIPE_SECRET_KEY,
  instagram: !!ENV.IG_ACCESS_TOKEN,
  competitors: !!ENV.APIFY_TOKEN && !!ENV.COMPETITORS,
  gmail: !!ENV.GOOGLE_ENABLED,
  calendar: !!ENV.GOOGLE_ENABLED,
  news: !!ENV.TAVILY_API_KEY,
};

const COMPETITORS = (ENV.COMPETITORS || '').split(',').map(h => h.trim()).filter(Boolean);
const USER_EMAIL = ENV.USER_EMAIL || '';

console.log('\n⚡ Command Center Proxy');
console.log('─────────────────────────────────');
console.log(`Stripe:      ${SERVICES.stripe ? '✓' : '—'}`);
console.log(`Instagram:   ${SERVICES.instagram ? '✓' : '—'}`);
console.log(`Competitors: ${SERVICES.competitors ? '✓ (' + COMPETITORS.length + ' handles)' : '—'}`);
console.log(`Gmail:       ${SERVICES.gmail ? '✓' : '—'}`);
console.log(`Calendar:    ${SERVICES.calendar ? '✓' : '—'}`);
console.log(`AI News:     ${SERVICES.news ? '✓' : '—'}`);
console.log('─────────────────────────────────\n');

/* ============================================
   HTTPS FETCH
   ============================================ */
function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

/* ============================================
   GWS CLI HELPER (for Gmail & Calendar)
   ============================================ */
function gws(cmd) {
  if (!SERVICES.gmail && !SERVICES.calendar) return { error: 'Google services not enabled' };
  try {
    const raw = execSync(`gws ${cmd} --format json 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' },
    });
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('Using '));
    return JSON.parse(lines.join('\n'));
  } catch (e) {
    return { error: e.message };
  }
}

/* ============================================
   ROUTES
   ============================================ */
const routes = {

  /* ── HEALTH ──────────────────────────────── */
  '/api/health': async () => ({
    status: 'ok',
    services: SERVICES,
    competitors: COMPETITORS,
  }),

  /* ── STRIPE ──────────────────────────────── */
  '/api/stripe': async (params) => {
    if (!SERVICES.stripe) return { error: 'Stripe not enabled' };

    const filter = params.get('filter') || 'today';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    let from, to;

    if (params.get('from') && params.get('to')) {
      from = new Date(params.get('from'));
      to = new Date(new Date(params.get('to')).getTime() + 86400000);
    } else {
      switch (filter) {
        case '7d': from = new Date(today.getTime() - 6 * 86400000); to = tomorrow; break;
        case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1); to = tomorrow; break;
        case '30d': from = new Date(today.getTime() - 29 * 86400000); to = tomorrow; break;
        default: from = today; to = tomorrow;
      }
    }

    const gte = Math.floor(from.getTime() / 1000);
    const lt = Math.floor(to.getTime() / 1000);
    const auth = { 'Authorization': 'Bearer ' + ENV.STRIPE_SECRET_KEY };

    const [charges, balTxns, disputes, refunds] = await Promise.all([
      fetchJSON(`https://api.stripe.com/v1/charges?limit=100&created[gte]=${gte}&created[lt]=${lt}`, { headers: auth }),
      fetchJSON(`https://api.stripe.com/v1/balance_transactions?limit=100&created[gte]=${gte}&created[lt]=${lt}`, { headers: auth }),
      fetchJSON(`https://api.stripe.com/v1/disputes?limit=20`, { headers: auth }),
      fetchJSON(`https://api.stripe.com/v1/refunds?limit=50&created[gte]=${gte}&created[lt]=${lt}`, { headers: auth }),
    ]);

    const btData = balTxns.data?.data || [];
    let gross = 0, fees = 0, netTotal = 0, refundAmount = 0;
    const transactions = [];

    for (const bt of btData) {
      if (bt.type === 'charge') {
        gross += bt.amount;
        fees += Math.abs(bt.fee || 0);
        netTotal += bt.net;
        transactions.push({
          date: new Date(bt.created * 1000).toISOString(),
          description: bt.description || 'Payment',
          amount: bt.amount, fee: Math.abs(bt.fee || 0), net: bt.net,
          status: 'succeeded', type: 'charge',
        });
      } else if (bt.type === 'refund') {
        refundAmount += Math.abs(bt.amount);
        transactions.push({
          date: new Date(bt.created * 1000).toISOString(),
          description: bt.description || 'Refund',
          amount: bt.amount, fee: bt.fee || 0, net: bt.net,
          status: 'refunded', type: 'refund',
        });
      }
    }

    if (btData.length === 0) {
      const chargeData = charges.data?.data || [];
      for (const c of chargeData) {
        if (c.status === 'succeeded') {
          const fee = Math.round(c.amount * 0.029 + 30);
          gross += c.amount; fees += fee; netTotal += c.amount - fee;
          transactions.push({
            date: new Date(c.created * 1000).toISOString(),
            description: c.description || c.statement_descriptor || 'Payment',
            customer: c.billing_details?.name || c.customer || '',
            amount: c.amount, fee, net: c.amount - fee,
            status: c.refunded ? 'refunded' : 'succeeded', type: 'charge',
          });
        }
      }
    }

    const activeDisputes = (disputes.data?.data || []).filter(d => d.status === 'needs_response' || d.status === 'warning_needs_response');

    return {
      gross, fees, net: netTotal, refundAmount,
      chargeCount: transactions.filter(t => t.type === 'charge').length,
      refundCount: (refunds.data?.data || []).length,
      disputeCount: activeDisputes.length,
      disputes: activeDisputes.map(d => ({ id: d.id, amount: d.amount, reason: d.reason, status: d.status })),
      transactions: transactions.sort((a, b) => new Date(b.date) - new Date(a.date)),
      dateRange: { from: from.toISOString(), to: to.toISOString(), filter },
    };
  },

  /* ── GMAIL ───────────────────────────────── */
  '/api/gmail': async (params) => {
    if (!SERVICES.gmail) return { error: 'Gmail not enabled' };
    const maxResults = params.get('max') || 20;

    const list = gws(`gmail users messages list --params '{"userId":"me","q":"is:unread category:primary","maxResults":${maxResults}}'`);
    const msgIds = (list.messages || []).map(m => m.id);

    if (msgIds.length === 0) {
      const recent = gws(`gmail users messages list --params '{"userId":"me","maxResults":${maxResults}}'`);
      msgIds.push(...(recent.messages || []).map(m => m.id));
    }

    const emails = [];
    for (const id of msgIds.slice(0, 15)) {
      const msg = gws(`gmail users messages get --params '{"userId":"me","id":"${id}","format":"full"}'`);
      if (msg.error) continue;

      const headers = msg.payload?.headers || [];
      const getHeader = (name) => (headers.find(h => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';

      const from = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');
      const snippet = msg.snippet || '';
      const threadId = msg.threadId;
      const labelIds = msg.labelIds || [];

      let body = '';
      const parts = msg.payload?.parts || [];
      if (parts.length > 0) {
        const textPart = parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
      }

      let priority = 0;
      const text = (from + ' ' + subject + ' ' + snippet).toLowerCase();
      const keywords = ['invoice','payment','urgent','reply','proposal','contract','partnership','revenue','client','deal','opportunity','meeting','call','asap','important','deadline','stripe','question','help','ready','confirm'];
      for (const kw of keywords) { if (text.includes(kw)) priority += 2; }
      if (text.includes('unsubscribe') || text.includes('noreply') || text.includes('no-reply') || text.includes('newsletter') || text.includes('notification')) priority -= 10;
      if (labelIds.includes('IMPORTANT')) priority += 3;

      emails.push({ id, threadId, from, subject, date, snippet, body: body.substring(0, 1000), priority, labelIds });
    }

    emails.sort((a, b) => b.priority - a.priority);
    const priorityEmails = emails.filter(e => e.priority > 0);
    return { emails: priorityEmails.length > 0 ? priorityEmails : emails.slice(0, 10) };
  },

  /* ── GMAIL THREAD ────────────────────────── */
  '/api/gmail/thread': async (params) => {
    if (!SERVICES.gmail) return { error: 'Gmail not enabled' };
    const threadId = params.get('threadId');
    if (!threadId) return { error: 'threadId required' };

    const thread = gws(`gmail users threads get --params '{"userId":"me","id":"${threadId}","format":"full"}'`);
    if (thread.error) return { error: thread.error };

    const messages = (thread.messages || []).map(msg => {
      const headers = msg.payload?.headers || [];
      const getHeader = (n) => (headers.find(h => h.name.toLowerCase() === n.toLowerCase()) || {}).value || '';
      let body = '';
      const parts = msg.payload?.parts || [];
      if (parts.length > 0) {
        const tp = parts.find(p => p.mimeType === 'text/plain');
        if (tp?.body?.data) body = Buffer.from(tp.body.data, 'base64').toString('utf8');
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
      }
      return { id: msg.id, from: getHeader('From'), to: getHeader('To'), date: getHeader('Date'), subject: getHeader('Subject'), body: body.substring(0, 2000) };
    });

    return { threadId, messages };
  },

  /* ── GMAIL SEND ──────────────────────────── */
  '/api/gmail/send': async (params, body) => {
    if (!SERVICES.gmail) return { error: 'Gmail not enabled' };
    const { to, subject, message, threadId, inReplyTo, references } = body || {};
    if (!to || !message) return { error: 'to and message required' };

    const rawHeaders = [`To: ${to}`, `Subject: ${subject || 'Re: '}`, `Content-Type: text/plain; charset=utf-8`];
    if (threadId) rawHeaders.push(`In-Reply-To: ${inReplyTo || ''}`);
    if (references) rawHeaders.push(`References: ${references}`);
    const raw = Buffer.from(rawHeaders.join('\r\n') + '\r\n\r\n' + message).toString('base64url');

    const sendBody = { raw };
    if (threadId) sendBody.threadId = threadId;
    return gws(`gmail users messages send --params '{"userId":"me"}' --json '${JSON.stringify(sendBody)}'`);
  },

  /* ── CALENDAR ────────────────────────────── */
  '/api/calendar': async (params) => {
    if (!SERVICES.calendar) return { error: 'Calendar not enabled' };
    const days = parseInt(params.get('days') || '7');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(today.getTime() + days * 86400000);

    const events = gws(`calendar events list --params '{"calendarId":"primary","timeMin":"${today.toISOString()}","timeMax":"${endDate.toISOString()}","singleEvents":true,"orderBy":"startTime","maxResults":50}'`);
    if (events.error) return { error: events.error };

    const items = (events.items || []).map(e => ({
      id: e.id, title: e.summary || 'Untitled',
      start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
      location: e.location || '', description: e.description || '',
      attendees: (e.attendees || []).map(a => ({ email: a.email, status: a.responseStatus })),
      hangoutLink: e.hangoutLink || '', allDay: !!e.start?.date,
    }));

    const byDay = {};
    for (const item of items) {
      const dateKey = new Date(item.start).toISOString().split('T')[0];
      if (!byDay[dateKey]) byDay[dateKey] = [];
      byDay[dateKey].push(item);
    }

    return { events: items, byDay, dateRange: { from: today.toISOString(), to: endDate.toISOString() } };
  },

  /* ── CALENDAR CREATE ─────────────────────── */
  '/api/calendar/create': async (params, body) => {
    if (!SERVICES.calendar) return { error: 'Calendar not enabled' };
    const { title, date, startTime, endTime, location, invites } = body || {};
    if (!title || !date || !startTime || !endTime) return { error: 'title, date, startTime, endTime required' };

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventBody = {
      summary: title,
      start: { dateTime: `${date}T${startTime}:00`, timeZone: tz },
      end: { dateTime: `${date}T${endTime}:00`, timeZone: tz },
    };
    if (location) eventBody.location = location;
    if (invites) eventBody.attendees = invites.split(',').map(e => ({ email: e.trim() }));

    return gws(`calendar events insert --params '{"calendarId":"primary","sendUpdates":"all"}' --json '${JSON.stringify(eventBody)}'`);
  },

  /* ── INSTAGRAM (YOUR POSTS) ─────────────── */
  '/api/instagram/me': async (params) => {
    if (!SERVICES.instagram) return { error: 'Instagram not enabled' };
    const limit = params.get('limit') || 25;

    const media = await fetchJSON(
      `https://graph.instagram.com/v19.0/me/media?fields=id,caption,media_type,timestamp,permalink,thumbnail_url,media_url&limit=${limit}&access_token=${ENV.IG_ACCESS_TOKEN}`
    );

    if (media.status !== 200) return { error: 'IG API error', details: media.data };

    const posts = media.data?.data || [];
    const results = [];

    for (const post of posts) {
      const isVideo = post.media_type === 'VIDEO';
      const metrics = isVideo
        ? 'reach,saved,views,shares,total_interactions,ig_reels_avg_watch_time'
        : 'reach,saved,shares,total_interactions';

      let insights = {};
      try {
        const ins = await fetchJSON(
          `https://graph.instagram.com/v19.0/${post.id}/insights?metric=${metrics}&access_token=${ENV.IG_ACCESS_TOKEN}`
        );
        if (ins.data?.data) {
          for (const m of ins.data.data) insights[m.name] = m.values?.[0]?.value || 0;
        }
      } catch {}

      results.push({
        id: post.id, caption: post.caption || '', type: post.media_type,
        timestamp: post.timestamp, permalink: post.permalink,
        thumbnailUrl: post.thumbnail_url || post.media_url || '',
        mediaUrl: post.media_url || '', insights, isVideo,
      });
    }

    return { posts: results };
  },

  /* ── INSTAGRAM COMPETITORS (APIFY) ──────── */
  '/api/instagram/competitors': async (params) => {
    if (!SERVICES.competitors) return { error: 'Competitor tracking not enabled' };

    const handles = (params.get('handles') || COMPETITORS.join(',')).split(',').map(h => h.trim());
    const postsPerHandle = parseInt(params.get('posts') || '5');
    const results = {};

    for (const handle of handles) {
      try {
        const run = await fetchJSON(
          `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${ENV.APIFY_TOKEN}`,
          { method: 'POST', body: { directUrls: [`https://www.instagram.com/${handle}/`], resultsType: 'posts', resultsLimit: postsPerHandle, searchType: 'user' } }
        );

        const runId = run.data?.data?.id;
        if (!runId) { results[handle] = { error: 'Failed to start actor' }; continue; }

        let status = 'RUNNING', attempts = 0;
        while (status === 'RUNNING' && attempts < 60) {
          await new Promise(r => setTimeout(r, 2000));
          const check = await fetchJSON(`https://api.apify.com/v2/actor-runs/${runId}?token=${ENV.APIFY_TOKEN}`);
          status = check.data?.data?.status || 'FAILED';
          attempts++;
        }

        if (status === 'SUCCEEDED') {
          const dataset = await fetchJSON(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${ENV.APIFY_TOKEN}`);
          results[handle] = (Array.isArray(dataset.data) ? dataset.data : []).map(p => ({
            caption: p.caption || '', type: p.type || 'Video', timestamp: p.timestamp,
            url: p.url || p.permalink || '', displayUrl: p.displayUrl || '', videoUrl: p.videoUrl || '',
            likesCount: p.likesCount || 0, commentsCount: p.commentsCount || 0,
            videoViewCount: p.videoViewCount || 0, videoPlayCount: p.videoPlayCount || 0,
          }));
        } else {
          results[handle] = { error: 'Run status: ' + status };
        }
      } catch (e) {
        results[handle] = { error: e.message };
      }
    }

    return { competitors: results };
  },

  /* ── AI NEWS ─────────────────────────────── */
  '/api/news': async () => {
    if (!SERVICES.news) return { error: 'AI News not enabled' };

    const result = await fetchJSON('https://api.tavily.com/search', {
      method: 'POST',
      body: {
        api_key: ENV.TAVILY_API_KEY,
        query: 'most important AI artificial intelligence news today',
        search_depth: 'advanced', max_results: 10,
        include_domains: ['news.ycombinator.com','reddit.com','x.com','twitter.com','techcrunch.com','theverge.com','arstechnica.com','wired.com','venturebeat.com'],
        topic: 'news',
      }
    });

    const articles = (result.data?.results || []).map(a => {
      let source = 'web';
      if (a.url?.includes('reddit.com')) source = 'reddit';
      else if (a.url?.includes('x.com') || a.url?.includes('twitter.com')) source = 'twitter';
      else if (a.url?.includes('news.ycombinator.com')) source = 'hn';
      return { title: a.title, url: a.url, content: (a.content || '').substring(0, 300), source, score: a.score, publishedDate: a.published_date };
    });

    return { articles };
  },
};

/* ============================================
   SERVER
   ============================================ */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Image proxy — /api/image?url=...
  if (url.pathname === '/api/image') {
    const imgUrl = url.searchParams.get('url');
    if (!imgUrl) { res.writeHead(400); res.end('Missing url param'); return; }
    try {
      const parsed = new URL(imgUrl);
      const imgReq = https.request({
        hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'image/*' },
      }, (imgRes) => {
        if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
          res.writeHead(302, { 'Location': '/api/image?url=' + encodeURIComponent(imgRes.headers.location) });
          res.end(); return;
        }
        res.writeHead(imgRes.statusCode, { 'Content-Type': imgRes.headers['content-type'] || 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
        imgRes.pipe(res);
      });
      imgReq.on('error', () => { res.writeHead(500); res.end(); });
      imgReq.end();
    } catch { res.writeHead(500); res.end(); }
    return;
  }

  const handler = routes[url.pathname];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', routes: Object.keys(routes) }));
    return;
  }

  let body = null;
  if (req.method === 'POST') {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', c => data += c);
      req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
  }

  try {
    console.log(`→ ${req.method} ${url.pathname}${url.search}`);
    const result = await handler(url.searchParams, body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    console.log(`  ✓ done`);
  } catch (e) {
    console.error(`  ✗ ${url.pathname}:`, e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`⚡ Proxy running at http://localhost:${PORT}\n`);
  console.log('Endpoints:');
  Object.keys(routes).forEach(r => console.log(`  ${r}`));
  console.log(`  /api/image?url=...`);
  console.log(`\nOpen dashboard.html in your browser to get started.\n`);
});
