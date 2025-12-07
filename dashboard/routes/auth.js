const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const https = require('https');
const { getMongoDatabase, isMongoConnected } = require('../../mongoManager.js');
const { isSuperAdmin, isServerAdmin, isGlobalBotAdmin } = require('../../serverConfigManager.js');

const router = express.Router();

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com';
const ADMIN_SESSIONS_COLLECTION = 'adminSessions';

function getBaseUrl() {
  if (process.env.WEBSITE_URL) {
    return process.env.WEBSITE_URL;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

function getRedirectUri() {
  const baseUrl = getBaseUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBase}/admin/callback`;
}

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function fetchDiscordUser(accessToken) {
  try {
    const response = await httpsRequest(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null;
    return response.data;
  } catch (error) {
    console.error('[Dashboard Auth] Error fetching Discord user:', error);
    return null;
  }
}

async function fetchDiscordGuilds(accessToken) {
  try {
    const response = await httpsRequest(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return [];
    return response.data;
  } catch (error) {
    console.error('[Dashboard Auth] Error fetching Discord guilds:', error);
    return [];
  }
}

async function exchangeCodeForToken(code, clientId, clientSecret) {
  const redirectUri = getRedirectUri();
  
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    }).toString();
    
    const response = await httpsRequest(`${DISCORD_API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    
    if (!response.ok) {
      console.error('[Dashboard Auth] Token exchange failed:', response.data);
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error('[Dashboard Auth] Error exchanging code for token:', error);
    return null;
  }
}

async function saveSession(userId, sessionData) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  try {
    await db.collection(ADMIN_SESSIONS_COLLECTION).updateOne(
      { userId: userId },
      {
        $set: {
          userId: userId,
          sessionId,
          accessToken: sessionData.accessToken,
          refreshToken: sessionData.refreshToken,
          expiresAt: new Date(Date.now() + sessionData.expiresIn * 1000),
          createdAt: new Date(),
          lastActivity: new Date()
        }
      },
      { upsert: true }
    );
    return sessionId;
  } catch (error) {
    console.error('[Dashboard Auth] Error saving session:', error);
    return null;
  }
}

async function getSession(sessionId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    const session = await db.collection(ADMIN_SESSIONS_COLLECTION).findOne({ sessionId });
    if (!session) return null;
    
    if (session.expiresAt < new Date()) {
      await db.collection(ADMIN_SESSIONS_COLLECTION).deleteOne({ sessionId });
      return null;
    }
    
    await db.collection(ADMIN_SESSIONS_COLLECTION).updateOne(
      { sessionId },
      { $set: { lastActivity: new Date() } }
    );
    
    return session;
  } catch (error) {
    console.error('[Dashboard Auth] Error getting session:', error);
    return null;
  }
}

async function deleteSession(sessionId) {
  if (!isMongoConnected()) return;
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(ADMIN_SESSIONS_COLLECTION).deleteOne({ sessionId });
  } catch (error) {
    console.error('[Dashboard Auth] Error deleting session:', error);
  }
}

function generateJWT(userId, sessionId, secret) {
  return jwt.sign(
    { userId: userId, sessionId },
    secret,
    { expiresIn: '7d' }
  );
}

function verifyJWT(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const token = req.cookies?.dashboard_token;
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const secret = process.env.SESSION_SECRET || 'default-secret-change-me';
  const decoded = verifyJWT(token, secret);
  
  if (!decoded) {
    res.clearCookie('dashboard_token');
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  
  const session = await getSession(decoded.sessionId);
  if (!session) {
    res.clearCookie('dashboard_token');
    return res.status(401).json({ success: false, error: 'Session expired' });
  }
  
  req.user = {
    userId: decoded.userId,
    sessionId: decoded.sessionId,
    accessToken: session.accessToken,
    isSuperAdmin: isSuperAdmin(decoded.userId),
    isGlobalAdmin: isGlobalBotAdmin(decoded.userId)
  };
  
  next();
}

function superAdminMiddleware(req, res, next) {
  if (!req.user?.isSuperAdmin && !req.user?.isGlobalAdmin) {
    return res.status(403).json({ success: false, error: 'Super admin access required' });
  }
  next();
}

router.get('/config', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = getRedirectUri();
  const baseUrl = getBaseUrl();
  
  res.json({
    baseUrl,
    redirectUri,
    clientIdSet: !!clientId,
    mongoConnected: isMongoConnected()
  });
});

router.get('/login', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  
  if (!clientId) {
    return res.status(500).json({ 
      success: false, 
      error: 'Discord OAuth not configured. Please set DISCORD_CLIENT_ID.' 
    });
  }
  
  const redirectUri = getRedirectUri();
  const state = crypto.randomBytes(16).toString('hex');
  
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: getBaseUrl().startsWith('https'),
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000
  });
  
  const scope = 'identify guilds';
  const authUrl = `https://discord.com/api/oauth2/authorize?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;
  
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const savedState = req.cookies?.oauth_state;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET || 'default-secret-change-me';
  
  res.clearCookie('oauth_state');
  
  if (oauthError) {
    return res.redirect('/admin?error=' + encodeURIComponent(oauthError));
  }
  
  if (!code) {
    return res.redirect('/admin?error=no_code');
  }
  
  if (!state || state !== savedState) {
    return res.redirect('/admin?error=state_mismatch');
  }
  
  if (!clientId || !clientSecret) {
    return res.redirect('/admin?error=missing_credentials');
  }
  
  const tokenData = await exchangeCodeForToken(code, clientId, clientSecret);
  if (!tokenData) {
    return res.redirect('/admin?error=token_exchange_failed');
  }
  
  const user = await fetchDiscordUser(tokenData.access_token);
  if (!user) {
    return res.redirect('/admin?error=fetch_user_failed');
  }
  
  const sessionId = await saveSession(user.id, {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in
  });
  
  if (!sessionId) {
    return res.redirect('/admin?error=session_save_failed');
  }
  
  const jwtToken = generateJWT(user.id, sessionId, sessionSecret);
  
  res.cookie('dashboard_token', jwtToken, {
    httpOnly: true,
    secure: getBaseUrl().startsWith('https'),
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  console.log('[Dashboard Auth] Login successful for user:', user.username);
  res.redirect('/admin');
});

router.get('/logout', async (req, res) => {
  const token = req.cookies?.dashboard_token;
  const sessionSecret = process.env.SESSION_SECRET || 'default-secret-change-me';
  
  if (token) {
    const decoded = verifyJWT(token, sessionSecret);
    if (decoded) {
      await deleteSession(decoded.sessionId);
    }
  }
  
  res.clearCookie('dashboard_token');
  res.redirect('/admin');
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await fetchDiscordUser(req.user.accessToken);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Failed to fetch user' });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar ? 
        `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.png` : 
        `${DISCORD_CDN}/embed/avatars/0.png`,
      isSuperAdmin: req.user.isSuperAdmin,
      isGlobalAdmin: req.user.isGlobalAdmin
    }
  });
});

router.get('/guilds', authMiddleware, async (req, res) => {
  const guilds = await fetchDiscordGuilds(req.user.accessToken);
  
  const ownedGuilds = guilds.filter(g => g.owner === true);
  
  res.json({
    success: true,
    guilds: ownedGuilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? 
        `${DISCORD_CDN}/icons/${g.id}/${g.icon}.png` : null,
      owner: g.owner
    }))
  });
});

module.exports = {
  router,
  authMiddleware,
  superAdminMiddleware,
  fetchDiscordUser,
  fetchDiscordGuilds,
  getBaseUrl,
  DISCORD_CDN
};
