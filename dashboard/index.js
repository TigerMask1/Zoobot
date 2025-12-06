const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth.js');
const serversRoutes = require('./routes/servers.js');
const charactersRoutes = require('./routes/characters.js');
const collectiblesRoutes = require('./routes/collectibles.js');

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

function setDiscordClient(client) {
  serversRoutes.setDiscordClient(client);
}

function setupDashboardRoutes(app, discordClient) {
  if (discordClient) {
    setDiscordClient(discordClient);
  }
  
  app.use('/dashboard/api', router);
  
  app.use('/dashboard', authRoutes.router);
  
  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
  });
  
  console.log('[Dashboard] Routes configured');
}

module.exports = {
  router,
  setupDashboardRoutes,
  setDiscordClient
};
