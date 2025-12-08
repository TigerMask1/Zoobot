const VALID_PROFANITY_MODES = ['off', 'basic', 'strict'];
const DISCORD_ID_REGEX = /^[0-9]{17,20}$/;

function validatePrefix(prefix) {
  if (!prefix || typeof prefix !== 'string') return { valid: false, error: 'Prefix is required' };
  if (prefix.length < 1 || prefix.length > 5) return { valid: false, error: 'Prefix must be 1-5 characters' };
  if (/\s/.test(prefix)) return { valid: false, error: 'Prefix cannot contain spaces' };
  return { valid: true };
}

function validateDiscordId(id, fieldName = 'ID') {
  if (!id) return { valid: true }; // Allow null/empty
  if (typeof id !== 'string') return { valid: false, error: `${fieldName} must be a string` };
  if (!DISCORD_ID_REGEX.test(id)) return { valid: false, error: `${fieldName} is not a valid Discord ID` };
  return { valid: true };
}

function validateDiscordIdArray(ids, fieldName = 'IDs') {
  if (!Array.isArray(ids)) return { valid: false, error: `${fieldName} must be an array` };
  for (const id of ids) {
    const result = validateDiscordId(id, fieldName);
    if (!result.valid) return result;
  }
  return { valid: true };
}

function validateProfanityMode(mode) {
  if (!mode) return { valid: true }; // Allow default
  if (!VALID_PROFANITY_MODES.includes(mode)) {
    return { valid: false, error: `Profanity mode must be one of: ${VALID_PROFANITY_MODES.join(', ')}` };
  }
  return { valid: true };
}

function validateNumber(value, min, max, fieldName) {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  if (isNaN(num)) return { valid: false, error: `${fieldName} must be a number` };
  if (min !== undefined && num < min) return { valid: false, error: `${fieldName} must be at least ${min}` };
  if (max !== undefined && num > max) return { valid: false, error: `${fieldName} must be at most ${max}` };
  return { valid: true };
}

function validateBoolean(value, fieldName) {
  if (value === undefined || value === null) return { valid: true };
  if (typeof value !== 'boolean') return { valid: false, error: `${fieldName} must be a boolean` };
  return { valid: true };
}

function validateString(value, maxLength, fieldName) {
  if (value === undefined || value === null) return { valid: true };
  if (typeof value !== 'string') return { valid: false, error: `${fieldName} must be a string` };
  if (maxLength && value.length > maxLength) return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
  return { valid: true };
}

function validateCoreSettings(settings) {
  const errors = [];
  
  if (settings.prefix !== undefined) {
    const result = validatePrefix(settings.prefix);
    if (!result.valid) errors.push(result.error);
  }
  
  if (settings.slashCommandsEnabled !== undefined) {
    const result = validateBoolean(settings.slashCommandsEnabled, 'slashCommandsEnabled');
    if (!result.valid) errors.push(result.error);
  }
  
  if (settings.disabledCommands !== undefined && !Array.isArray(settings.disabledCommands)) {
    errors.push('disabledCommands must be an array');
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validatePermissions(settings) {
  const errors = [];
  
  if (settings.zooAdminRoleName !== undefined) {
    const result = validateString(settings.zooAdminRoleName, 100, 'zooAdminRoleName');
    if (!result.valid) errors.push(result.error);
  }
  
  const roleArrayFields = ['adminRoleIds', 'moderatorRoleIds', 'trustedRoleIds', 'blockedRoleIds'];
  for (const field of roleArrayFields) {
    if (settings[field] !== undefined) {
      const result = validateDiscordIdArray(settings[field], field);
      if (!result.valid) errors.push(result.error);
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validateChannels(settings) {
  const errors = [];
  const channelFields = ['dropChannelId', 'eventsChannelId', 'updatesChannelId', 'battleChannelId', 
                         'logChannelId', 'giveawayChannelId', 'welcomeChannelId', 'leaveChannelId', 'announcementChannelId'];
  
  for (const field of channelFields) {
    if (settings[field] !== undefined && settings[field] !== null && settings[field] !== '') {
      const result = validateDiscordId(settings[field], field);
      if (!result.valid) errors.push(result.error);
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validateModeration(settings) {
  const errors = [];
  
  if (settings.autoModEnabled !== undefined) {
    const result = validateBoolean(settings.autoModEnabled, 'autoModEnabled');
    if (!result.valid) errors.push(result.error);
  }
  
  if (settings.profanityFilterMode !== undefined) {
    const result = validateProfanityMode(settings.profanityFilterMode);
    if (!result.valid) errors.push(result.error);
  }
  
  if (settings.maxWarningsBeforeBan !== undefined) {
    const result = validateNumber(settings.maxWarningsBeforeBan, 1, 20, 'maxWarningsBeforeBan');
    if (!result.valid) errors.push(result.error);
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validateEconomy(settings) {
  const errors = [];
  
  if (settings.earnRates) {
    if (settings.earnRates.daily !== undefined) {
      const result = validateNumber(settings.earnRates.daily, 0, 100000, 'daily reward');
      if (!result.valid) errors.push(result.error);
    }
    if (settings.earnRates.work !== undefined) {
      const result = validateNumber(settings.earnRates.work, 0, 100000, 'work reward');
      if (!result.valid) errors.push(result.error);
    }
  }
  
  if (settings.rewardMultipliers) {
    if (settings.rewardMultipliers.events !== undefined) {
      const result = validateNumber(settings.rewardMultipliers.events, 0.1, 10, 'event multiplier');
      if (!result.valid) errors.push(result.error);
    }
  }
  
  if (settings.marketplaceFee !== undefined) {
    const result = validateNumber(settings.marketplaceFee, 0, 1, 'marketplace fee');
    if (!result.valid) errors.push(result.error);
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validateOnboarding(settings) {
  const errors = [];
  
  if (settings.welcomeEnabled !== undefined) {
    const result = validateBoolean(settings.welcomeEnabled, 'welcomeEnabled');
    if (!result.valid) errors.push(result.error);
  }
  
  if (settings.welcomeMessage !== undefined) {
    const result = validateString(settings.welcomeMessage, 2000, 'welcomeMessage');
    if (!result.valid) errors.push(result.error);
  }
  
  if (settings.autoRoles !== undefined && !Array.isArray(settings.autoRoles)) {
    errors.push('autoRoles must be an array');
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

module.exports = {
  validatePrefix,
  validateDiscordId,
  validateDiscordIdArray,
  validateProfanityMode,
  validateNumber,
  validateBoolean,
  validateString,
  validateCoreSettings,
  validatePermissions,
  validateChannels,
  validateModeration,
  validateEconomy,
  validateOnboarding,
  VALID_PROFANITY_MODES
};
