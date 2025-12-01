const fs = require('fs');
const path = require('path');

const commands = new Map();
const commandAliases = new Map();
const commandCategories = new Map();

const CATEGORIES = {
  admin: { name: 'Admin', emoji: '⚙️', description: 'Administrative commands' },
  economy: { name: 'Economy', emoji: '💰', description: 'Economy and currency commands' },
  characters: { name: 'Characters', emoji: '🦁', description: 'Character management commands' },
  battle: { name: 'Battle', emoji: '⚔️', description: 'Battle and combat commands' },
  social: { name: 'Social', emoji: '🤝', description: 'Social and community commands' },
  moderation: { name: 'Moderation', emoji: '🛡️', description: 'Moderation commands' },
  work: { name: 'Work', emoji: '⛏️', description: 'Work and resource commands' }
};

function registerCommand(command) {
  if (!command.name || !command.execute) {
    console.error('Invalid command structure:', command);
    return false;
  }

  commands.set(command.name, command);
  
  if (command.aliases && Array.isArray(command.aliases)) {
    for (const alias of command.aliases) {
      commandAliases.set(alias, command.name);
    }
  }
  
  if (command.category) {
    if (!commandCategories.has(command.category)) {
      commandCategories.set(command.category, []);
    }
    commandCategories.get(command.category).push(command.name);
  }

  return true;
}

function loadCommandsFromDirectory(directory) {
  if (!fs.existsSync(directory)) {
    console.log(`Directory ${directory} does not exist, skipping...`);
    return;
  }

  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      loadCommandsFromDirectory(filePath);
    } else if (file.endsWith('.js') && file !== 'commandHandler.js') {
      try {
        const commandModule = require(filePath);
        
        if (Array.isArray(commandModule)) {
          for (const cmd of commandModule) {
            if (registerCommand(cmd)) {
              console.log(`✅ Loaded command: ${cmd.name}`);
            }
          }
        } else if (commandModule.name) {
          if (registerCommand(commandModule)) {
            console.log(`✅ Loaded command: ${commandModule.name}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error loading command file ${file}:`, error.message);
      }
    }
  }
}

function initializeCommands(commandsDir = path.join(__dirname)) {
  console.log('📦 Loading commands...');
  loadCommandsFromDirectory(commandsDir);
  console.log(`✅ Loaded ${commands.size} commands with ${commandAliases.size} aliases`);
}

function getCommand(commandName) {
  const lowerName = commandName.toLowerCase();
  
  if (commands.has(lowerName)) {
    return commands.get(lowerName);
  }
  
  if (commandAliases.has(lowerName)) {
    const primaryName = commandAliases.get(lowerName);
    return commands.get(primaryName);
  }
  
  return null;
}

function getAllCommands() {
  return Array.from(commands.values());
}

function getCommandsByCategory(category) {
  const commandNames = commandCategories.get(category) || [];
  return commandNames.map(name => commands.get(name)).filter(Boolean);
}

function getCategoryInfo() {
  return CATEGORIES;
}

async function executeCommand(commandName, context) {
  const command = getCommand(commandName);
  
  if (!command) {
    return { executed: false, reason: 'unknown_command' };
  }

  const { message, args, data, client } = context;
  const userId = message.author.id;

  if (command.adminOnly) {
    const { isSuperAdmin, isBotAdmin } = require('../serverConfigManager.js');
    if (!isSuperAdmin(userId) && !isBotAdmin(userId, message.guild?.id)) {
      return { executed: false, reason: 'no_permission', message: '❌ This command requires admin privileges!' };
    }
  }

  if (command.superAdminOnly) {
    const { isSuperAdmin } = require('../serverConfigManager.js');
    if (!isSuperAdmin(userId)) {
      return { executed: false, reason: 'no_permission', message: '❌ This command is for Super Admins only!' };
    }
  }

  if (command.cooldown) {
    const { checkCooldown } = require('../utils/shared.js');
    const cooldownCheck = checkCooldown(userId, command.name, command.cooldown);
    if (cooldownCheck.onCooldown) {
      return { executed: false, reason: 'cooldown', message: `⏰ Please wait ${cooldownCheck.remaining} before using this command again!` };
    }
  }

  try {
    await command.execute(context);
    return { executed: true };
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    return { executed: false, reason: 'error', error: error.message };
  }
}

module.exports = {
  registerCommand,
  initializeCommands,
  getCommand,
  getAllCommands,
  getCommandsByCategory,
  getCategoryInfo,
  executeCommand,
  commands,
  commandAliases,
  CATEGORIES
};
