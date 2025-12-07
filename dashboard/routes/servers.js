const express = require('express');
const { authMiddleware, fetchDiscordGuilds, DISCORD_CDN } = require('./auth.js');
const db = require('../database.js');
const { MINIMUM_CHARACTERS_REQUIRED } = require('../schemas.js');

const router = express.Router();

let discordClient = null;

function setDiscordClient(client) {
  discordClient = client;
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const ownedGuilds = guilds.filter(g => g.owner === true);
    
    const serversWithConfig = await Promise.all(
      ownedGuilds.map(async (guild) => {
        const config = await db.getServerConfig(guild.id);
        const botInstalled = discordClient ? discordClient.guilds.cache.has(guild.id) : false;
        
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon ? `${DISCORD_CDN}/icons/${guild.id}/${guild.icon}.png` : null,
          owner: guild.owner,
          botInstalled,
          setupComplete: config?.setupComplete || false,
          characterCount: config?.selectedCharacterIds?.length || 0,
          collectibleCount: config?.selectedCollectibleIds?.length || 0,
          minimumRequired: MINIMUM_CHARACTERS_REQUIRED
        };
      })
    );
    
    res.json({
      success: true,
      servers: serversWithConfig
    });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting servers:', error);
    res.status(500).json({ success: false, error: 'Failed to get servers' });
  }
});

router.get('/:serverId', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized for this server' });
    }
    
    let config = await db.getServerConfig(serverId);
    
    if (!config) {
      let serverName = guild?.name || 'Unknown Server';
      let serverIcon = guild?.icon ? `${DISCORD_CDN}/icons/${serverId}/${guild.icon}.png` : null;
      
      if (discordClient) {
        const cachedGuild = discordClient.guilds.cache.get(serverId);
        if (cachedGuild) {
          serverName = cachedGuild.name;
          serverIcon = cachedGuild.iconURL();
        }
      }
      
      await db.createOrUpdateServerConfig(serverId, {
        serverName,
        serverIcon,
        ownerId: req.user.userId
      });
      
      config = await db.getServerConfig(serverId);
    }
    
    const characters = await db.getServerCharacters(serverId);
    const collectibles = await db.getServerCollectibles(serverId);
    
    res.json({
      success: true,
      server: {
        id: serverId,
        name: config.serverName,
        icon: config.serverIcon,
        setupComplete: config.setupComplete,
        characterCount: characters.length,
        collectibleCount: collectibles.length,
        minimumRequired: MINIMUM_CHARACTERS_REQUIRED,
        config: {
          channels: config.channels || {},
          features: config.features || {},
          pingSettings: config.pingSettings || {},
          moderationSettings: config.moderationSettings || {},
          commandSettings: config.commandSettings || {},
          serverAdmins: config.serverAdmins || [],
          zooAdminRoleName: config.zooAdminRoleName || 'zooadmin'
        },
        characters,
        collectibles
      }
    });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting server:', error);
    res.status(500).json({ success: false, error: 'Failed to get server details' });
  }
});

router.put('/:serverId/features', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { features } = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerFeatures(serverId, features);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'features', data: features });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating features:', error);
    res.status(500).json({ success: false, error: 'Failed to update features' });
  }
});

router.put('/:serverId/channels', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { channels } = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerChannels(serverId, channels);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'channels', data: channels });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating channels:', error);
    res.status(500).json({ success: false, error: 'Failed to update channels' });
  }
});

router.put('/:serverId/ping-settings', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { pingSettings } = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerPingSettings(serverId, pingSettings);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'pingSettings', data: pingSettings });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating ping settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update ping settings' });
  }
});

router.post('/:serverId/characters/:characterId', authMiddleware, async (req, res) => {
  const { serverId, characterId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.addCharacterToServer(serverId, characterId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'characterAdded', 
        data: { characterId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error adding character:', error);
    res.status(500).json({ success: false, error: 'Failed to add character' });
  }
});

router.delete('/:serverId/characters/:characterId', authMiddleware, async (req, res) => {
  const { serverId, characterId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.removeCharacterFromServer(serverId, characterId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'characterRemoved', 
        data: { characterId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error removing character:', error);
    res.status(500).json({ success: false, error: 'Failed to remove character' });
  }
});

router.post('/:serverId/collectibles/:collectibleId', authMiddleware, async (req, res) => {
  const { serverId, collectibleId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.addCollectibleToServer(serverId, collectibleId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'collectibleAdded', 
        data: { collectibleId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error adding collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to add collectible' });
  }
});

router.delete('/:serverId/collectibles/:collectibleId', authMiddleware, async (req, res) => {
  const { serverId, collectibleId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.removeCollectibleFromServer(serverId, collectibleId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'collectibleRemoved', 
        data: { collectibleId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error removing collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to remove collectible' });
  }
});

router.get('/:serverId/channels-list', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  
  try {
    if (!discordClient) {
      return res.json({ success: true, channels: [] });
    }
    
    const guild = discordClient.guilds.cache.get(serverId);
    if (!guild) {
      return res.json({ success: true, channels: [] });
    }
    
    const textChannels = guild.channels.cache
      .filter(c => c.type === 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        category: c.parent?.name || null
      }));
    
    res.json({ success: true, channels: textChannels });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting channels:', error);
    res.status(500).json({ success: false, error: 'Failed to get channels' });
  }
});

router.get('/:serverId/roles-list', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  
  try {
    if (!discordClient) {
      return res.json({ success: true, roles: [] });
    }
    
    const guild = discordClient.guilds.cache.get(serverId);
    if (!guild) {
      return res.json({ success: true, roles: [] });
    }
    
    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor
      }));
    
    res.json({ success: true, roles });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting roles:', error);
    res.status(500).json({ success: false, error: 'Failed to get roles' });
  }
});

module.exports = {
  router,
  setDiscordClient
};
