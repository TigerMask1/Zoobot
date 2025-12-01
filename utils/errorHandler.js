const { EmbedBuilder } = require('discord.js');

const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  DISCORD_API: 'DISCORD_API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  SYSTEM: 'SYSTEM_ERROR',
  USER_INPUT: 'USER_INPUT_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  COOLDOWN: 'COOLDOWN_ERROR'
};

const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION]: 'Invalid input provided.',
  [ERROR_TYPES.DATABASE]: 'A database error occurred. Please try again later.',
  [ERROR_TYPES.DISCORD_API]: 'Discord API error. Please try again.',
  [ERROR_TYPES.RATE_LIMIT]: 'Too many requests. Please slow down.',
  [ERROR_TYPES.PERMISSION]: 'You do not have permission to do this.',
  [ERROR_TYPES.SYSTEM]: 'An unexpected error occurred.',
  [ERROR_TYPES.USER_INPUT]: 'Please check your input and try again.',
  [ERROR_TYPES.NOT_FOUND]: 'The requested resource was not found.',
  [ERROR_TYPES.COOLDOWN]: 'This command is on cooldown.'
};

class BotError extends Error {
  constructor(type, message, details = {}) {
    super(message || ERROR_MESSAGES[type] || 'An error occurred');
    this.name = 'BotError';
    this.type = type;
    this.details = details;
    this.timestamp = Date.now();
  }

  toEmbed() {
    return new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Error')
      .setDescription(this.message)
      .setTimestamp();
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

const errorLog = [];
const MAX_ERROR_LOG_SIZE = 1000;

function logError(error, context = {}) {
  const errorEntry = {
    timestamp: Date.now(),
    type: error.type || ERROR_TYPES.SYSTEM,
    message: error.message,
    stack: error.stack,
    context: {
      command: context.command,
      userId: context.userId,
      guildId: context.guildId,
      ...context
    }
  };

  console.error(`[${new Date().toISOString()}] ${errorEntry.type}: ${errorEntry.message}`);
  if (process.env.NODE_ENV === 'development' && error.stack) {
    console.error(error.stack);
  }

  errorLog.push(errorEntry);
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  return errorEntry;
}

function getRecentErrors(count = 10) {
  return errorLog.slice(-count);
}

function getErrorsByType(type, count = 10) {
  return errorLog.filter(e => e.type === type).slice(-count);
}

function clearErrorLog() {
  errorLog.length = 0;
}

async function handleCommandError(error, message, commandName) {
  const context = {
    command: commandName,
    userId: message.author?.id,
    guildId: message.guild?.id,
    channelId: message.channel?.id
  };

  logError(error, context);

  const userMessage = error instanceof BotError 
    ? error.message 
    : 'An unexpected error occurred. Please try again later.';

  try {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Error')
      .setDescription(userMessage)
      .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {
      message.channel.send({ embeds: [embed] }).catch(() => {});
    });
  } catch (replyError) {
    console.error('Failed to send error message:', replyError.message);
  }
}

async function handleInteractionError(error, interaction) {
  const context = {
    command: interaction.commandName || interaction.customId,
    userId: interaction.user?.id,
    guildId: interaction.guild?.id,
    type: interaction.type
  };

  logError(error, context);

  const userMessage = error instanceof BotError 
    ? error.message 
    : 'An unexpected error occurred. Please try again later.';

  try {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Error')
      .setDescription(userMessage)
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  } catch (replyError) {
    console.error('Failed to send interaction error:', replyError.message);
  }
}

function wrapAsync(fn) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      logError(error, { function: fn.name });
      throw error;
    }
  };
}

function createSafeHandler(fn, fallback = null) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      logError(error, { function: fn.name });
      return typeof fallback === 'function' ? fallback(...args) : fallback;
    }
  };
}

function assertNotNull(value, message = 'Value is null or undefined') {
  if (value === null || value === undefined) {
    throw new BotError(ERROR_TYPES.VALIDATION, message);
  }
  return value;
}

function assertUser(data, userId) {
  if (!data.users || !data.users[userId]) {
    throw new BotError(ERROR_TYPES.NOT_FOUND, 'User data not found. Use a command to create your profile first.');
  }
  return data.users[userId];
}

function assertPositiveNumber(value, fieldName = 'Value') {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    throw new BotError(ERROR_TYPES.VALIDATION, `${fieldName} must be a positive number.`);
  }
  return num;
}

function assertInRange(value, min, max, fieldName = 'Value') {
  const num = Number(value);
  if (isNaN(num) || num < min || num > max) {
    throw new BotError(ERROR_TYPES.VALIDATION, `${fieldName} must be between ${min} and ${max}.`);
  }
  return num;
}

module.exports = {
  ERROR_TYPES,
  ERROR_MESSAGES,
  BotError,
  logError,
  getRecentErrors,
  getErrorsByType,
  clearErrorLog,
  handleCommandError,
  handleInteractionError,
  wrapAsync,
  createSafeHandler,
  assertNotNull,
  assertUser,
  assertPositiveNumber,
  assertInRange
};
