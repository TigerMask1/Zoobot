const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const https = require('https');
const { getMongoDatabase, isMongoConnected } = require('./mongoManager.js');
const { isSuperAdmin, getServerConfig, getSuperAdmins } = require('./serverConfigManager.js');

const ADMIN_SESSIONS_COLLECTION = 'adminSessions';
const ADMIN_BUNDLES_COLLECTION = 'adminBundles';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com';

function getBaseUrl() {
  return process.env.WEBSITE_URL || 
         process.env.RENDER_EXTERNAL_URL || 
         `http://localhost:${process.env.PORT || 5000}`;
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
    console.error('[AdminDashboard] Error fetching Discord user:', error);
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
    console.error('[AdminDashboard] Error fetching Discord guilds:', error);
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
      console.error('[AdminDashboard] Token exchange failed:', response.data);
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error('[AdminDashboard] Error exchanging code for token:', error);
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
    console.error('[AdminDashboard] Error saving session:', error);
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
    console.error('[AdminDashboard] Error getting session:', error);
    return null;
  }
}

async function deleteSession(sessionId) {
  if (!isMongoConnected()) return;
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(ADMIN_SESSIONS_COLLECTION).deleteOne({ sessionId });
  } catch (error) {
    console.error('[AdminDashboard] Error deleting session:', error);
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
  const token = req.cookies?.admin_token;
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const secret = process.env.SESSION_SECRET || 'default-secret-change-me';
  const decoded = verifyJWT(token, secret);
  
  if (!decoded) {
    res.clearCookie('admin_token');
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  
  const session = await getSession(decoded.sessionId);
  if (!session) {
    res.clearCookie('admin_token');
    return res.status(401).json({ success: false, error: 'Session expired' });
  }
  
  if (!isSuperAdmin(decoded.userId)) {
    return res.status(403).json({ success: false, error: 'Not authorized as admin' });
  }
  
  req.user = {
    userId: decoded.userId,
    sessionId: decoded.sessionId,
    accessToken: session.accessToken
  };
  
  next();
}

async function getBundles() {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    return await db.collection(ADMIN_BUNDLES_COLLECTION).find({}).toArray();
  } catch (error) {
    console.error('[AdminDashboard] Error getting bundles:', error);
    return [];
  }
}

async function getBundleById(bundleId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    return await db.collection(ADMIN_BUNDLES_COLLECTION).findOne({ _id: new ObjectId(bundleId) });
  } catch (error) {
    console.error('[AdminDashboard] Error getting bundle:', error);
    return null;
  }
}

async function createBundle(bundleData) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const bundle = {
      name: bundleData.name,
      description: bundleData.description || '',
      characters: bundleData.characters || [],
      isActive: bundleData.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: bundleData.createdBy
    };
    
    const result = await db.collection(ADMIN_BUNDLES_COLLECTION).insertOne(bundle);
    return { success: true, bundleId: result.insertedId };
  } catch (error) {
    console.error('[AdminDashboard] Error creating bundle:', error);
    return { success: false, message: 'Failed to create bundle' };
  }
}

async function updateBundle(bundleId, updates) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    updates.updatedAt = new Date();
    await db.collection(ADMIN_BUNDLES_COLLECTION).updateOne(
      { _id: new ObjectId(bundleId) },
      { $set: updates }
    );
    return { success: true };
  } catch (error) {
    console.error('[AdminDashboard] Error updating bundle:', error);
    return { success: false, message: 'Failed to update bundle' };
  }
}

async function deleteBundle(bundleId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    await db.collection(ADMIN_BUNDLES_COLLECTION).deleteOne({ _id: new ObjectId(bundleId) });
    return { success: true };
  } catch (error) {
    console.error('[AdminDashboard] Error deleting bundle:', error);
    return { success: false, message: 'Failed to delete bundle' };
  }
}

async function addCharacterToBundle(bundleId, characterName) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    await db.collection(ADMIN_BUNDLES_COLLECTION).updateOne(
      { _id: new ObjectId(bundleId) },
      { 
        $addToSet: { characters: characterName },
        $set: { updatedAt: new Date() }
      }
    );
    return { success: true };
  } catch (error) {
    console.error('[AdminDashboard] Error adding character to bundle:', error);
    return { success: false, message: 'Failed to add character' };
  }
}

async function removeCharacterFromBundle(bundleId, characterName) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    await db.collection(ADMIN_BUNDLES_COLLECTION).updateOne(
      { _id: new ObjectId(bundleId) },
      { 
        $pull: { characters: characterName },
        $set: { updatedAt: new Date() }
      }
    );
    return { success: true };
  } catch (error) {
    console.error('[AdminDashboard] Error removing character from bundle:', error);
    return { success: false, message: 'Failed to remove character' };
  }
}

function setupAdminRoutes(app, discordClient = null) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET || 'default-secret-change-me';
  
  app.use(cookieParser());
  
  app.get('/admin/config', (req, res) => {
    const redirectUri = getRedirectUri();
    const baseUrl = getBaseUrl();
    
    res.json({
      baseUrl,
      redirectUri,
      clientIdSet: !!clientId,
      clientSecretSet: !!clientSecret,
      mongoConnected: isMongoConnected(),
      renderUrl: process.env.RENDER_EXTERNAL_URL || null,
      websiteUrl: process.env.WEBSITE_URL || null
    });
  });
  
  app.get('/admin/login', (req, res) => {
    if (!clientId) {
      return res.status(500).send(`
        <html>
          <head><title>Admin Login Error</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>Configuration Error</h1>
            <p>DISCORD_CLIENT_ID is not set in environment variables.</p>
            <p>Please add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to your environment.</p>
          </body>
        </html>
      `);
    }
    
    const redirectUri = getRedirectUri();
    const state = crypto.randomBytes(16).toString('hex');
    
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || getBaseUrl().startsWith('https'),
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
    
    console.log('[AdminDashboard] Redirecting to Discord OAuth');
    console.log('[AdminDashboard] Redirect URI:', redirectUri);
    
    res.redirect(authUrl);
  });
  
  app.get('/admin/callback', async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const savedState = req.cookies?.oauth_state;
    
    res.clearCookie('oauth_state');
    
    if (oauthError) {
      console.error('[AdminDashboard] OAuth error:', oauthError);
      return res.redirect('/admin?error=' + encodeURIComponent(oauthError));
    }
    
    if (!code) {
      return res.redirect('/admin?error=no_code');
    }
    
    if (!state || state !== savedState) {
      console.error('[AdminDashboard] State mismatch');
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
    
    if (!isSuperAdmin(user.id)) {
      return res.redirect('/admin?error=not_authorized');
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
    
    res.cookie('admin_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || getBaseUrl().startsWith('https'),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    console.log('[AdminDashboard] Login successful for user:', user.username);
    res.redirect('/admin');
  });
  
  app.get('/admin/logout', async (req, res) => {
    const token = req.cookies?.admin_token;
    
    if (token) {
      const decoded = verifyJWT(token, sessionSecret);
      if (decoded) {
        await deleteSession(decoded.sessionId);
      }
    }
    
    res.clearCookie('admin_token');
    res.redirect('/admin');
  });
  
  app.get('/api/admin/me', authMiddleware, async (req, res) => {
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
          `${DISCORD_CDN}/embed/avatars/0.png`
      }
    });
  });
  
  app.get('/api/admin/guilds', authMiddleware, async (req, res) => {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    
    const ownedGuildsWithBot = guilds.filter(g => {
      const isOwner = g.owner === true;
      const botInstalled = discordClient && discordClient.guilds && discordClient.guilds.cache.has(g.id);
      return isOwner && botInstalled;
    });
    
    res.json({
      success: true,
      guilds: ownedGuildsWithBot.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? 
          `${DISCORD_CDN}/icons/${g.id}/${g.icon}.png` : null,
        owner: g.owner
      }))
    });
  });
  
  app.get('/api/admin/bundles', authMiddleware, async (req, res) => {
    const bundles = await getBundles();
    res.json({ success: true, bundles });
  });
  
  app.post('/api/admin/bundles', authMiddleware, async (req, res) => {
    const { name, description, characters } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Bundle name is required' });
    }
    
    const result = await createBundle({
      name,
      description,
      characters: characters || [],
      createdBy: req.user.userId
    });
    
    res.json(result);
  });
  
  app.put('/api/admin/bundles/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, description, characters, isActive } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (characters !== undefined) updates.characters = characters;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const result = await updateBundle(id, updates);
    res.json(result);
  });
  
  app.delete('/api/admin/bundles/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const result = await deleteBundle(id);
    res.json(result);
  });
  
  app.post('/api/admin/bundles/:id/characters', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { characterName } = req.body;
    
    if (!characterName) {
      return res.status(400).json({ success: false, error: 'Character name required' });
    }
    
    const result = await addCharacterToBundle(id, characterName);
    res.json(result);
  });
  
  app.delete('/api/admin/bundles/:id/characters/:name', authMiddleware, async (req, res) => {
    const { id, name } = req.params;
    const result = await removeCharacterFromBundle(id, decodeURIComponent(name));
    res.json(result);
  });
  
  app.get('/api/admin/characters', authMiddleware, (req, res) => {
    try {
      const characterManager = require('./characterManager.js');
      const characters = characterManager.getCharacters();
      res.json({
        success: true,
        characters: characters.map(c => ({
          name: c.name,
          emoji: c.emoji,
          game: c.game,
          obtainable: c.obtainable
        }))
      });
    } catch (error) {
      console.error('[AdminDashboard] Error getting characters:', error);
      res.json({ success: false, error: 'Failed to get characters' });
    }
  });
  
  app.get('/api/admin/stats', authMiddleware, async (req, res) => {
    try {
      let bundleCount = 0;
      let collectibleCount = 0;
      
      if (isMongoConnected()) {
        const db = getMongoDatabase();
        [bundleCount, collectibleCount] = await Promise.all([
          db.collection(ADMIN_BUNDLES_COLLECTION).countDocuments(),
          db.collection('collectibleItems').countDocuments({ status: 'active' })
        ]);
      }
      
      let guildCount = 0;
      if (discordClient && discordClient.guilds) {
        guildCount = discordClient.guilds.cache.size;
      }
      
      let characterCount = 0;
      try {
        const characterManager = require('./characterManager.js');
        const chars = characterManager.getCharacters();
        characterCount = Array.isArray(chars) ? chars.length : 0;
      } catch (e) {
        console.error('[AdminDashboard] Error loading characters:', e.message);
        characterCount = 0;
      }
      
      let itemCount = 0;
      try {
        const itemsSystem = require('./itemsSystem.js');
        const allItems = itemsSystem.getAllShopItems ? itemsSystem.getAllShopItems() : [];
        itemCount = Array.isArray(allItems) ? allItems.length : 0;
      } catch (e) {
        console.error('[AdminDashboard] Error loading items:', e.message);
        itemCount = 0;
      }
      
      res.json({
        success: true,
        stats: {
          bundles: bundleCount,
          collectibles: collectibleCount,
          guilds: guildCount,
          characters: characterCount,
          items: itemCount
        }
      });
    } catch (error) {
      console.error('[AdminDashboard] Error getting stats:', error);
      res.json({ success: false, error: 'Failed to get stats' });
    }
  });
  
  app.get('/api/admin/server/:serverId/config', authMiddleware, async (req, res) => {
    try {
      const { serverId } = req.params;
      const serverConfigManager = require('./serverConfigManager.js');
      const config = serverConfigManager.getServerConfig(serverId) || {};
      
      res.json({
        success: true,
        config: config.features || {},
        characters: config.enabledCharacters || [],
        bundleId: config.bundleId || null
      });
    } catch (error) {
      console.error('[AdminDashboard] Error getting server config:', error);
      res.json({ success: false, error: 'Failed to get server config' });
    }
  });
  
  app.put('/api/admin/server/:serverId/config', authMiddleware, async (req, res) => {
    try {
      const { serverId } = req.params;
      const { features, characters } = req.body;
      const serverConfigManager = require('./serverConfigManager.js');
      
      const existingConfig = serverConfigManager.getServerConfig(serverId) || { serverId };
      
      const updatedConfig = {
        ...existingConfig,
        serverId,
        features: features || existingConfig.features || {},
        enabledCharacters: characters || existingConfig.enabledCharacters || []
      };
      
      await serverConfigManager.saveServerConfig(serverId, updatedConfig);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AdminDashboard] Error saving server config:', error);
      res.json({ success: false, error: 'Failed to save server config' });
    }
  });
  
  app.put('/api/admin/server/:serverId/bundle', authMiddleware, async (req, res) => {
    try {
      const { serverId } = req.params;
      const { bundleId } = req.body;
      const serverConfigManager = require('./serverConfigManager.js');
      
      const existingConfig = serverConfigManager.getServerConfig(serverId) || { serverId };
      
      const updatedConfig = {
        ...existingConfig,
        serverId,
        bundleId: bundleId || null
      };
      
      if (bundleId) {
        const bundle = await getBundleById(bundleId);
        if (bundle && bundle.characters) {
          updatedConfig.enabledCharacters = bundle.characters;
        }
      }
      
      await serverConfigManager.saveServerConfig(serverId, updatedConfig);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AdminDashboard] Error saving server bundle:', error);
      res.json({ success: false, error: 'Failed to save server bundle' });
    }
  });
  
  app.get('/api/admin/collectibles', authMiddleware, async (req, res) => {
    try {
      if (!isMongoConnected()) {
        return res.json({ success: false, error: 'Database not connected' });
      }
      
      const db = getMongoDatabase();
      const { bundle, page = 1 } = req.query;
      const pageNum = parseInt(page) || 1;
      const limit = 20;
      
      const query = { status: 'active' };
      if (bundle) {
        query.$or = [{ bundle }, { isGlobal: true }];
      }
      
      const total = await db.collection('collectibleItems').countDocuments(query);
      const items = await db.collection('collectibleItems')
        .find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limit)
        .limit(limit)
        .toArray();
      
      res.json({ success: true, items, total, pages: Math.ceil(total / limit), page: pageNum });
    } catch (error) {
      console.error('[AdminDashboard] Error getting collectibles:', error);
      res.json({ success: false, error: 'Failed to get collectibles' });
    }
  });
  
  app.post('/api/admin/collectibles', authMiddleware, async (req, res) => {
    try {
      if (!isMongoConnected()) {
        return res.json({ success: false, error: 'Database not connected' });
      }
      
      const db = getMongoDatabase();
      const { name, description, imageUrl, emoji, rarity, bundle, isGlobal, droppable, crateObtainable, baseValue } = req.body;
      
      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }
      
      const item = {
        name,
        description: description || '',
        imageUrl: imageUrl || '',
        emoji: emoji || '🎁',
        rarity: rarity || 'common',
        bundle: bundle || null,
        isGlobal: isGlobal || false,
        droppable: droppable || { enabled: false, probability: 5 },
        crateObtainable: crateObtainable || { enabled: false, probability: 5, crates: [] },
        tradable: true,
        giftable: true,
        sellable: true,
        baseValue: baseValue || 100,
        computedValue: baseValue || 100,
        stackable: true,
        ownerCount: 0,
        totalQuantity: 0,
        status: 'active',
        createdBy: req.user.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('collectibleItems').insertOne(item);
      res.json({ success: true, itemId: result.insertedId });
    } catch (error) {
      console.error('[AdminDashboard] Error creating collectible:', error);
      res.json({ success: false, error: 'Failed to create collectible' });
    }
  });
  
  app.get('/api/admin/collectible-submissions', authMiddleware, async (req, res) => {
    try {
      if (!isMongoConnected()) {
        return res.json({ success: false, error: 'Database not connected' });
      }
      
      const db = getMongoDatabase();
      const submissions = await db.collection('collectibleItemSubmissions')
        .find({ status: 'pending' })
        .sort({ submittedAt: -1 })
        .toArray();
      
      res.json({ success: true, submissions });
    } catch (error) {
      console.error('[AdminDashboard] Error getting submissions:', error);
      res.json({ success: false, error: 'Failed to get submissions' });
    }
  });
  
  app.post('/api/admin/collectible-submissions/:id/approve', authMiddleware, async (req, res) => {
    try {
      if (!isMongoConnected()) {
        return res.json({ success: false, error: 'Database not connected' });
      }
      
      const db = getMongoDatabase();
      const { ObjectId } = require('mongodb');
      const { id } = req.params;
      
      const submission = await db.collection('collectibleItemSubmissions').findOne({ _id: new ObjectId(id) });
      if (!submission) {
        return res.status(404).json({ success: false, error: 'Submission not found' });
      }
      
      const item = {
        ...submission,
        status: 'active',
        approvedBy: req.user.userId,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      delete item._id;
      delete item.submittedAt;
      
      await db.collection('collectibleItems').insertOne(item);
      await db.collection('collectibleItemSubmissions').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved', approvedBy: req.user.userId, approvedAt: new Date() } }
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AdminDashboard] Error approving submission:', error);
      res.json({ success: false, error: 'Failed to approve submission' });
    }
  });
  
  app.post('/api/admin/collectible-submissions/:id/reject', authMiddleware, async (req, res) => {
    try {
      if (!isMongoConnected()) {
        return res.json({ success: false, error: 'Database not connected' });
      }
      
      const db = getMongoDatabase();
      const { ObjectId } = require('mongodb');
      const { id } = req.params;
      const { reason } = req.body;
      
      await db.collection('collectibleItemSubmissions').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', rejectedBy: req.user.userId, rejectedAt: new Date(), rejectionReason: reason } }
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AdminDashboard] Error rejecting submission:', error);
      res.json({ success: false, error: 'Failed to reject submission' });
    }
  });
  
  app.get('/api/admin/character-submissions', authMiddleware, async (req, res) => {
    try {
      if (!isMongoConnected()) {
        return res.json({ success: false, error: 'Database not connected' });
      }
      
      const db = getMongoDatabase();
      const submissions = await db.collection('characterSubmissions')
        .find({ status: 'pending' })
        .sort({ submittedAt: -1 })
        .toArray();
      
      res.json({ success: true, submissions });
    } catch (error) {
      console.error('[AdminDashboard] Error getting character submissions:', error);
      res.json({ success: false, error: 'Failed to get character submissions' });
    }
  });
  
  app.post('/api/admin/backfill-servers', authMiddleware, async (req, res) => {
    try {
      if (!discordClient || !discordClient.guilds) {
        return res.json({ success: false, error: 'Discord client not available' });
      }
      
      const serverConfigManager = require('./serverConfigManager.js');
      const characterManager = require('./characterManager.js');
      
      const zoobotCharacters = characterManager.getCharacters()
        .filter(c => c.game === 'ZooBot')
        .map(c => c.name);
      
      let backfilledCount = 0;
      let skippedCount = 0;
      
      for (const [guildId, guild] of discordClient.guilds.cache) {
        const existingConfig = serverConfigManager.getServerConfig(guildId);
        
        if (existingConfig && existingConfig.enabledCharacters && existingConfig.enabledCharacters.length > 0) {
          skippedCount++;
          continue;
        }
        
        const config = {
          serverId: guildId,
          serverName: guild.name,
          enabledCharacters: zoobotCharacters,
          selectedGame: 'ZooBot',
          features: existingConfig?.features || {},
          backfilledAt: new Date()
        };
        
        await serverConfigManager.saveServerConfig(guildId, config);
        backfilledCount++;
      }
      
      res.json({ 
        success: true, 
        message: `Backfilled ${backfilledCount} servers with ZooBot characters. Skipped ${skippedCount} servers with existing config.`,
        backfilled: backfilledCount,
        skipped: skippedCount
      });
    } catch (error) {
      console.error('[AdminDashboard] Error backfilling servers:', error);
      res.json({ success: false, error: 'Failed to backfill servers' });
    }
  });
  
  app.get('/admin', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'admin.html'));
  });
  
  console.log('[AdminDashboard] Admin routes initialized');
  console.log('[AdminDashboard] Redirect URI:', getRedirectUri());
}

module.exports = {
  setupAdminRoutes,
  authMiddleware,
  getBaseUrl,
  getRedirectUri,
  getBundles,
  createBundle,
  updateBundle,
  deleteBundle,
  addCharacterToBundle,
  removeCharacterFromBundle
};
