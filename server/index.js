const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const WEBSITE_URL = process.env.REPL_SLUG 
  ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
  : process.env.WEBSITE_URL || 'http://localhost:5000';
const REDIRECT_URI = `${WEBSITE_URL}/auth/discord/callback`;

const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex');

const sessions = new Map();

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function getSession(req) {
  const sessionId = req.signedCookies.session;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function createSession(data) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, {
    ...data,
    createdAt: Date.now(),
  });
  
  setTimeout(() => {
    sessions.delete(sessionId);
  }, 7 * 24 * 60 * 60 * 1000);
  
  return sessionId;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.session = session;
  next();
}

app.get('/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: 'Discord OAuth not configured' });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    signed: true,
  });
  
  res.cookie('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    signed: true,
  });

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  console.log(`[OAuth] Redirecting to Discord. Redirect URI: ${REDIRECT_URI}`);
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    console.error(`[OAuth] Discord returned error: ${error}`);
    return res.redirect('/?error=oauth_denied');
  }
  
  if (!code) {
    console.error('[OAuth] No code received');
    return res.redirect('/?error=no_code');
  }

  const savedState = req.signedCookies.oauth_state;
  const codeVerifier = req.signedCookies.code_verifier;
  
  if (!savedState || savedState !== state) {
    console.error('[OAuth] State mismatch');
    return res.redirect('/?error=invalid_state');
  }
  
  if (!codeVerifier) {
    console.error('[OAuth] No code verifier found');
    return res.redirect('/?error=missing_verifier');
  }

  res.clearCookie('oauth_state');
  res.clearCookie('code_verifier');

  try {
    const tokenParams = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[OAuth] Token exchange failed:', errorData);
      return res.redirect('/?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('[OAuth] Failed to fetch user');
      return res.redirect('/?error=user_fetch_failed');
    }

    const user = await userResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let guilds = [];
    if (guildsResponse.ok) {
      guilds = await guildsResponse.json();
    }

    const sessionId = createSession({
      user,
      guilds,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      },
    });

    res.cookie('session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      signed: true,
    });

    console.log(`[OAuth] Login successful for ${user.username}`);
    res.redirect('/dashboard');
    
  } catch (err) {
    console.error('[OAuth] Callback error:', err);
    res.redirect('/?error=callback_failed');
  }
});

app.post('/auth/logout', (req, res) => {
  const sessionId = req.signedCookies.session;
  if (sessionId) {
    destroySession(sessionId);
  }
  res.clearCookie('session');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const session = getSession(req);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    user: session.user,
    guilds: session.guilds || [],
  });
});

app.get('/api/guilds', requireAuth, (req, res) => {
  res.json({
    guilds: req.session.guilds || [],
  });
});

app.get('/api/servers/:serverId/config', requireAuth, async (req, res) => {
  const { serverId } = req.params;
  
  const hasAccess = req.session.guilds?.some(g => 
    g.id === serverId && ((parseInt(g.permissions) & 0x20) === 0x20 || g.owner)
  );
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'No access to this server' });
  }
  
  res.json({
    game: 'default',
    dropChannelId: '',
    dropPing: false,
    eventPing: false,
    giveawayPing: false,
    lotteryPing: false,
  });
});

app.patch('/api/servers/:serverId/config', requireAuth, async (req, res) => {
  const { serverId } = req.params;
  
  const hasAccess = req.session.guilds?.some(g => 
    g.id === serverId && ((parseInt(g.permissions) & 0x20) === 0x20 || g.owner)
  );
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'No access to this server' });
  }
  
  console.log(`[Config] Updating server ${serverId}:`, req.body);
  
  res.json({ success: true, ...req.body });
});

app.get('/api/bundles', requireAuth, (req, res) => {
  res.json({
    bundles: [
      { id: 'default', name: 'Default Bundle', description: 'The original character collection.', characterCount: 50 },
      { id: 'animals', name: 'Animal Kingdom', description: 'Cute and wild animals.', characterCount: 35 },
      { id: 'fantasy', name: 'Fantasy Realm', description: 'Dragons and mythical creatures.', characterCount: 40 },
      { id: 'scifi', name: 'Sci-Fi Universe', description: 'Robots and aliens.', characterCount: 30 },
    ],
  });
});

app.get('/api/bundles/:bundleId/characters', requireAuth, (req, res) => {
  res.json({
    characters: [],
  });
});

const submissions = new Map();

app.get('/api/submissions', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const userSubmissions = [];
  
  submissions.forEach((sub, id) => {
    if (sub.userId === userId) {
      userSubmissions.push({ id, ...sub });
    }
  });
  
  userSubmissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ submissions: userSubmissions });
});

app.post('/api/submissions', requireAuth, (req, res) => {
  const { characterName, description, abilities, rarity, imageUrl, notes } = req.body;
  
  if (!characterName || !characterName.trim()) {
    return res.status(400).json({ error: 'Character name is required' });
  }
  
  const id = crypto.randomBytes(8).toString('hex');
  const submission = {
    characterName: characterName.trim(),
    description: description || '',
    abilities: abilities || '',
    rarity: rarity || 'common',
    imageUrl: imageUrl || '',
    notes: notes || '',
    userId: req.session.user.id,
    username: req.session.user.username,
    status: 'pending',
    createdAt: new Date().toISOString(),
    feedback: null,
  };
  
  submissions.set(id, submission);
  
  console.log(`[Submissions] New submission from ${req.session.user.username}: ${characterName}`);
  
  res.json({ success: true, id, ...submission });
});

app.put('/api/account/preferences', requireAuth, (req, res) => {
  console.log(`[Account] Updating preferences for ${req.session.user.username}:`, req.body);
  res.json({ success: true });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../website/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../website/dist/index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API server running on port ${PORT}`);
  console.log(`[Server] Website URL: ${WEBSITE_URL}`);
  console.log(`[Server] Redirect URI: ${REDIRECT_URI}`);
  console.log(`[Server] Discord OAuth configured: ${!!DISCORD_CLIENT_ID}`);
});

module.exports = app;
