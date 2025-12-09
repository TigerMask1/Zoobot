const express = require('express');
const { authMiddleware, fetchDiscordGuilds, DISCORD_CDN } = require('./auth.js');
const db = require('../database.js');
const validation = require('../validation.js');
const { 
  MINIMUM_CHARACTERS_REQUIRED,
  DEFAULT_CORE,
  DEFAULT_PERMISSIONS,
  DEFAULT_CHANNELS,
  DEFAULT_FEATURES,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_MODERATION,
  DEFAULT_ECONOMY,
  DEFAULT_ONBOARDING,
  DEFAULT_AUTOMATION,
  RARITY_TYPES,
  OBTAINABLE_TYPES,
  EFFECT_TYPES,
  CRATE_TYPES
} = require('../schemas.js');

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
          characterCount: config?.selectedCharacterNames?.length || config?.selectedCharacterIds?.length || 0,
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
    
    const formattedChars = characters.map(c => ({
      id: c._id.toString(),
      name: c.name,
      emoji: c.emoji,
      imageUrl: c.imageUrl,
      rarity: c.rarity,
      obtainable: c.obtainable
    }));
    
    const formattedCollectibles = collectibles.map(c => ({
      id: c._id.toString(),
      name: c.name,
      emoji: c.emoji,
      imageUrl: c.imageUrl,
      rarity: c.rarity
    }));
    
    res.json({
      success: true,
      server: {
        id: serverId,
        name: config.serverName,
        icon: config.serverIcon,
        setupComplete: config.setupComplete,
        characterCount: formattedChars.length,
        collectibleCount: formattedCollectibles.length,
        minimumRequired: MINIMUM_CHARACTERS_REQUIRED,
        config: {
          core: config.core || { ...DEFAULT_CORE },
          permissions: config.permissions || { ...DEFAULT_PERMISSIONS },
          channels: config.channels || { ...DEFAULT_CHANNELS },
          features: config.features || { ...DEFAULT_FEATURES },
          notificationSettings: config.notificationSettings || { ...DEFAULT_NOTIFICATIONS },
          moderationSettings: config.moderationSettings || { ...DEFAULT_MODERATION },
          economySettings: config.economySettings || { ...DEFAULT_ECONOMY },
          onboardingSettings: config.onboardingSettings || { ...DEFAULT_ONBOARDING },
          automationSettings: config.automationSettings || { ...DEFAULT_AUTOMATION },
          pingSettings: config.pingSettings || { ...DEFAULT_NOTIFICATIONS },
          commandSettings: config.commandSettings || {},
          serverAdmins: config.serverAdmins || [],
          zooAdminRoleName: config.permissions?.zooAdminRoleName || config.zooAdminRoleName || 'zooadmin'
        },
        characters: formattedChars,
        collectibles: formattedCollectibles
      }
    });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting server:', error);
    res.status(500).json({ success: false, error: 'Failed to get server details' });
  }
});

router.get('/:serverId/config', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized for this server' });
    }
    
    const config = await db.getServerConfig(serverId);
    
    if (!config) {
      return res.status(404).json({ success: false, error: 'Server config not found' });
    }
    
    res.json({
      success: true,
      config: {
        core: config.core || { ...DEFAULT_CORE },
        permissions: config.permissions || { ...DEFAULT_PERMISSIONS },
        channels: config.channels || { ...DEFAULT_CHANNELS },
        features: config.features || { ...DEFAULT_FEATURES },
        notificationSettings: config.notificationSettings || { ...DEFAULT_NOTIFICATIONS },
        moderationSettings: config.moderationSettings || { ...DEFAULT_MODERATION },
        economySettings: config.economySettings || { ...DEFAULT_ECONOMY },
        onboardingSettings: config.onboardingSettings || { ...DEFAULT_ONBOARDING },
        automationSettings: config.automationSettings || { ...DEFAULT_AUTOMATION },
        pingSettings: config.pingSettings || { ...DEFAULT_NOTIFICATIONS },
        serverAdmins: config.serverAdmins || [],
        selectedCharacterNames: config.selectedCharacterNames || [],
        selectedCollectibleIds: config.selectedCollectibleIds || [],
        setupComplete: config.setupComplete || false
      }
    });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting server config:', error);
    res.status(500).json({ success: false, error: 'Failed to get server config' });
  }
});

router.patch('/:serverId/core', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const coreSettings = req.body;
  
  try {
    const validationResult = validation.validateCoreSettings(coreSettings);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, errors: validationResult.errors });
    }
    
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerCoreSettings(serverId, coreSettings);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'core', data: coreSettings });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating core settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update core settings' });
  }
});

router.patch('/:serverId/permissions', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const permissions = req.body;
  
  try {
    const validationResult = validation.validatePermissions(permissions);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, errors: validationResult.errors });
    }
    
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerPermissions(serverId, permissions);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'permissions', data: permissions });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to update permissions' });
  }
});

router.patch('/:serverId/notifications', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const notifications = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerNotifications(serverId, notifications);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'notifications', data: notifications });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to update notifications' });
  }
});

router.patch('/:serverId/moderation', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const moderation = req.body;
  
  try {
    const validationResult = validation.validateModeration(moderation);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, errors: validationResult.errors });
    }
    
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerModeration(serverId, moderation);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'moderation', data: moderation });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating moderation settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update moderation settings' });
  }
});

router.patch('/:serverId/economy', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const economy = req.body;
  
  try {
    const validationResult = validation.validateEconomy(economy);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, errors: validationResult.errors });
    }
    
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerEconomy(serverId, economy);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'economy', data: economy });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating economy settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update economy settings' });
  }
});

router.patch('/:serverId/onboarding', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const onboarding = req.body;
  
  try {
    const validationResult = validation.validateOnboarding(onboarding);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, errors: validationResult.errors });
    }
    
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerOnboarding(serverId, onboarding);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'onboarding', data: onboarding });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating onboarding settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update onboarding settings' });
  }
});

router.patch('/:serverId/automation', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const automation = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.updateServerAutomation(serverId, automation);
    
    if (discordClient) {
      discordClient.emit('dashboardConfigUpdate', { serverId, type: 'automation', data: automation });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating automation settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update automation settings' });
  }
});

router.patch('/:serverId/features', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const features = req.body;
  
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

router.patch('/:serverId/channels', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const channels = req.body;
  
  try {
    const validationResult = validation.validateChannels(channels);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, errors: validationResult.errors });
    }
    
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

router.patch('/:serverId/ping-settings', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const pingSettings = req.body;
  
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

router.put('/:serverId/characters', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { names, ids } = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const characterNames = names || ids || [];
    const result = await db.setServerCharacterNames(serverId, characterNames);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'charactersUpdated', 
        data: { characterNames } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating characters:', error);
    res.status(500).json({ success: false, error: 'Failed to update characters' });
  }
});

router.put('/:serverId/collectibles', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { ids } = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.setServerCollectibles(serverId, ids || []);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'collectiblesUpdated', 
        data: { collectibleIds: ids } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating collectibles:', error);
    res.status(500).json({ success: false, error: 'Failed to update collectibles' });
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

router.post('/:serverId/complete-setup', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const config = await db.getServerConfig(serverId);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Server config not found' });
    }
    
    const characterCount = config.selectedCharacterNames?.length || config.selectedCharacterIds?.length || 0;
    if (characterCount < MINIMUM_CHARACTERS_REQUIRED) {
      return res.status(400).json({ 
        success: false, 
        error: `Need at least ${MINIMUM_CHARACTERS_REQUIRED} characters to complete setup` 
      });
    }
    
    const result = await db.completeServerSetup(serverId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'setupCompleted', 
        data: {} 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error completing setup:', error);
    res.status(500).json({ success: false, error: 'Failed to complete setup' });
  }
});

router.get('/:serverId/channels', authMiddleware, async (req, res) => {
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

router.get('/:serverId/roles', authMiddleware, async (req, res) => {
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

router.get('/:serverId/custom-characters', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { rarity, obtainable, search } = req.query;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const filters = {};
    if (rarity) filters.rarity = rarity;
    if (obtainable) filters.obtainable = obtainable;
    if (search) filters.search = search;
    
    const characters = await db.getServerSpecificCharacters(serverId, filters);
    
    res.json({ 
      success: true, 
      characters,
      meta: {
        rarityTypes: RARITY_TYPES,
        obtainableTypes: OBTAINABLE_TYPES,
        effectTypes: EFFECT_TYPES,
        crateTypes: CRATE_TYPES
      }
    });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting custom characters:', error);
    res.status(500).json({ success: false, error: 'Failed to get custom characters' });
  }
});

router.get('/:serverId/custom-characters/:characterId', authMiddleware, async (req, res) => {
  const { serverId, characterId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const character = await db.getServerCharacterById(serverId, characterId);
    
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }
    
    res.json({ success: true, character });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting custom character:', error);
    res.status(500).json({ success: false, error: 'Failed to get character' });
  }
});

router.post('/:serverId/custom-characters', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const characterData = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const errors = [];
    
    if (!characterData.name || characterData.name.trim().length < 2) {
      errors.push('Name is required (minimum 2 characters)');
    }
    if (!characterData.emoji || characterData.emoji.trim().length === 0) {
      errors.push('Emoji is required');
    }
    if (!characterData.description || characterData.description.trim().length < 10) {
      errors.push('Description is required (minimum 10 characters)');
    }
    if (!characterData.imageUrl || !characterData.imageUrl.startsWith('http')) {
      errors.push('Valid image URL is required');
    }
    if (!characterData.rarity || !RARITY_TYPES.includes(characterData.rarity)) {
      errors.push(`Rarity must be one of: ${RARITY_TYPES.join(', ')}`);
    }
    if (!characterData.obtainable || !OBTAINABLE_TYPES.includes(characterData.obtainable)) {
      errors.push(`Obtainable type must be one of: ${OBTAINABLE_TYPES.join(', ')}`);
    }
    
    if (!characterData.ability || !characterData.ability.name) {
      errors.push('Ability name is required');
    }
    if (!characterData.ability || !characterData.ability.description) {
      errors.push('Ability description is required');
    }
    if (!characterData.ability || !characterData.ability.effectType || !EFFECT_TYPES.includes(characterData.ability.effectType)) {
      errors.push(`Ability effect type must be one of: ${EFFECT_TYPES.join(', ')}`);
    }
    if (!characterData.ability || typeof characterData.ability.effectValue !== 'number') {
      errors.push('Ability effect value is required (number)');
    }
    
    if (!characterData.specialMove || !characterData.specialMove.name) {
      errors.push('Special move name is required');
    }
    if (!characterData.specialMove || typeof characterData.specialMove.damage !== 'number') {
      errors.push('Special move damage is required (number)');
    }
    
    if (!characterData.stats) {
      errors.push('Stats are required');
    } else {
      if (typeof characterData.stats.hp !== 'number' || characterData.stats.hp < 1) {
        errors.push('HP stat is required (positive number)');
      }
      if (typeof characterData.stats.attack !== 'number' || characterData.stats.attack < 1) {
        errors.push('Attack stat is required (positive number)');
      }
      if (typeof characterData.stats.defense !== 'number' || characterData.stats.defense < 1) {
        errors.push('Defense stat is required (positive number)');
      }
      if (typeof characterData.stats.speed !== 'number' || characterData.stats.speed < 1) {
        errors.push('Speed stat is required (positive number)');
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    
    characterData.createdBy = req.user.userId;
    
    const result = await db.createServerCharacter(serverId, characterData);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'customCharacterCreated', 
        data: { characterId: result.characterId, name: characterData.name } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error creating custom character:', error);
    res.status(500).json({ success: false, error: 'Failed to create character' });
  }
});

router.put('/:serverId/custom-characters/:characterId', authMiddleware, async (req, res) => {
  const { serverId, characterId } = req.params;
  const updates = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const existing = await db.getServerCharacterById(serverId, characterId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }
    
    const errors = [];
    
    if (updates.name !== undefined && updates.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    if (updates.rarity !== undefined && !RARITY_TYPES.includes(updates.rarity)) {
      errors.push(`Rarity must be one of: ${RARITY_TYPES.join(', ')}`);
    }
    if (updates.obtainable !== undefined && !OBTAINABLE_TYPES.includes(updates.obtainable)) {
      errors.push(`Obtainable type must be one of: ${OBTAINABLE_TYPES.join(', ')}`);
    }
    if (updates.ability?.effectType !== undefined && !EFFECT_TYPES.includes(updates.ability.effectType)) {
      errors.push(`Ability effect type must be one of: ${EFFECT_TYPES.join(', ')}`);
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    
    const result = await db.updateServerCharacter(serverId, characterId, updates);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'customCharacterUpdated', 
        data: { characterId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating custom character:', error);
    res.status(500).json({ success: false, error: 'Failed to update character' });
  }
});

router.delete('/:serverId/custom-characters/:characterId', authMiddleware, async (req, res) => {
  const { serverId, characterId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.deleteServerCharacter(serverId, characterId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'customCharacterDeleted', 
        data: { characterId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error deleting custom character:', error);
    res.status(500).json({ success: false, error: 'Failed to delete character' });
  }
});

router.get('/:serverId/custom-collectibles', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const { rarity, search } = req.query;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const filters = {};
    if (rarity) filters.rarity = rarity;
    if (search) filters.search = search;
    
    const collectibles = await db.getServerSpecificCollectibles(serverId, filters);
    
    res.json({ 
      success: true, 
      collectibles,
      meta: {
        rarityTypes: RARITY_TYPES,
        crateTypes: CRATE_TYPES
      }
    });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting custom collectibles:', error);
    res.status(500).json({ success: false, error: 'Failed to get custom collectibles' });
  }
});

router.get('/:serverId/custom-collectibles/:collectibleId', authMiddleware, async (req, res) => {
  const { serverId, collectibleId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const collectible = await db.getServerCollectibleById(serverId, collectibleId);
    
    if (!collectible) {
      return res.status(404).json({ success: false, error: 'Collectible not found' });
    }
    
    res.json({ success: true, collectible });
  } catch (error) {
    console.error('[Dashboard Servers] Error getting custom collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to get collectible' });
  }
});

router.post('/:serverId/custom-collectibles', authMiddleware, async (req, res) => {
  const { serverId } = req.params;
  const collectibleData = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const errors = [];
    
    if (!collectibleData.name || collectibleData.name.trim().length < 2) {
      errors.push('Name is required (minimum 2 characters)');
    }
    if (!collectibleData.description || collectibleData.description.trim().length < 10) {
      errors.push('Description is required (minimum 10 characters)');
    }
    if (!collectibleData.emoji || collectibleData.emoji.trim().length === 0) {
      errors.push('Emoji is required');
    }
    if (!collectibleData.imageUrl || !collectibleData.imageUrl.startsWith('http')) {
      errors.push('Valid image URL is required');
    }
    if (!collectibleData.rarity || !RARITY_TYPES.includes(collectibleData.rarity)) {
      errors.push(`Rarity must be one of: ${RARITY_TYPES.join(', ')}`);
    }
    if (typeof collectibleData.baseValue !== 'number' || collectibleData.baseValue < 1) {
      errors.push('Base value is required (positive number)');
    }
    
    if (collectibleData.droppable?.enabled && typeof collectibleData.droppable.probability !== 'number') {
      errors.push('Drop probability is required when droppable is enabled');
    }
    
    if (collectibleData.crateObtainable?.enabled) {
      if (typeof collectibleData.crateObtainable.probability !== 'number') {
        errors.push('Crate probability is required when crate obtainable is enabled');
      }
      if (!collectibleData.crateObtainable.crates || collectibleData.crateObtainable.crates.length === 0) {
        errors.push('At least one crate type must be selected when crate obtainable is enabled');
      }
      if (collectibleData.crateObtainable.crates) {
        const invalidCrates = collectibleData.crateObtainable.crates.filter(c => !CRATE_TYPES.includes(c));
        if (invalidCrates.length > 0) {
          errors.push(`Invalid crate types: ${invalidCrates.join(', ')}. Valid types: ${CRATE_TYPES.join(', ')}`);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    
    collectibleData.createdBy = req.user.userId;
    
    const result = await db.createServerCollectible(serverId, collectibleData);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'customCollectibleCreated', 
        data: { collectibleId: result.collectibleId, name: collectibleData.name } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error creating custom collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to create collectible' });
  }
});

router.put('/:serverId/custom-collectibles/:collectibleId', authMiddleware, async (req, res) => {
  const { serverId, collectibleId } = req.params;
  const updates = req.body;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const existing = await db.getServerCollectibleById(serverId, collectibleId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Collectible not found' });
    }
    
    const errors = [];
    
    if (updates.name !== undefined && updates.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    if (updates.rarity !== undefined && !RARITY_TYPES.includes(updates.rarity)) {
      errors.push(`Rarity must be one of: ${RARITY_TYPES.join(', ')}`);
    }
    if (updates.crateObtainable?.crates) {
      const invalidCrates = updates.crateObtainable.crates.filter(c => !CRATE_TYPES.includes(c));
      if (invalidCrates.length > 0) {
        errors.push(`Invalid crate types: ${invalidCrates.join(', ')}`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    
    const result = await db.updateServerCollectible(serverId, collectibleId, updates);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'customCollectibleUpdated', 
        data: { collectibleId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error updating custom collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to update collectible' });
  }
});

router.delete('/:serverId/custom-collectibles/:collectibleId', authMiddleware, async (req, res) => {
  const { serverId, collectibleId } = req.params;
  
  try {
    const guilds = await fetchDiscordGuilds(req.user.accessToken);
    const guild = guilds.find(g => g.id === serverId && g.owner);
    
    if (!guild && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    const result = await db.deleteServerCollectible(serverId, collectibleId);
    
    if (result.success && discordClient) {
      discordClient.emit('dashboardConfigUpdate', { 
        serverId, 
        type: 'customCollectibleDeleted', 
        data: { collectibleId } 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Servers] Error deleting custom collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collectible' });
  }
});

router.use((err, req, res, next) => {
  console.error('[Dashboard Servers] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'An unexpected error occurred' });
});

module.exports = {
  router,
  setDiscordClient
};
