const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth.js');
const serversRoutes = require('./routes/servers.js');
const charactersRoutes = require('./routes/characters.js');
const collectiblesRoutes = require('./routes/collectibles.js');
const db = require('./database.js');
const { isMongoConnected } = require('../mongoManager.js');

const router = express.Router();

router.use('/auth', authRoutes.router);
router.use('/servers', serversRoutes.router);
router.use('/characters', charactersRoutes.router);
router.use('/collectibles', collectiblesRoutes.router);

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Dashboard API is running',
    timestamp: new Date().toISOString()
  });
});

router.get('/stats', authRoutes.authMiddleware, async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Dashboard] Error getting stats:', error);
    res.json({ success: true, stats: { guilds: 0, bundles: 0, characters: 0 } });
  }
});

router.get('/bundles', authRoutes.authMiddleware, async (req, res) => {
  res.json({ success: true, bundles: [] });
});

router.post('/bundles', authRoutes.authMiddleware, authRoutes.superAdminMiddleware, async (req, res) => {
  res.json({ success: true, message: 'Bundle feature coming soon' });
});

let cachedDiscordClient = null;

router.post('/servers/backfill', authRoutes.authMiddleware, authRoutes.superAdminMiddleware, async (req, res) => {
  try {
    if (!cachedDiscordClient) {
      return res.status(503).json({ success: false, error: 'Discord bot not connected. Please ensure the bot is running.' });
    }
    const result = await db.backfillServersFromBot(cachedDiscordClient);
    if (result.success) {
      res.json({ success: true, message: result.message || 'Servers backfilled with ZooBot characters' });
    } else {
      res.json({ success: false, error: result.message || 'Failed to backfill servers' });
    }
  } catch (error) {
    console.error('[Dashboard] Error backfilling servers:', error);
    res.status(500).json({ success: false, error: 'Failed to backfill servers' });
  }
});

function setDiscordClient(client) {
  cachedDiscordClient = client;
  serversRoutes.setDiscordClient(client);
}

function setupDashboardRoutes(app, discordClient) {
  if (discordClient) {
    setDiscordClient(discordClient);
  }
  
  app.use('/admin/api', router);
  
  app.use('/admin', authRoutes.router);
  
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
  });
  
  app.get('/admin/server/:serverId', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
  });
  
  console.log('[Dashboard] Routes configured at /admin');
}

module.exports = {
  router,
  setupDashboardRoutes,
  setDiscordClient
};
