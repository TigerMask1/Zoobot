const PATTERNS = {
  USER_MENTION: /^<@!?(\d+)>$/,
  ROLE_MENTION: /^<@&(\d+)>$/,
  CHANNEL_MENTION: /^<#(\d+)>$/,
  EMOJI_CUSTOM: /<a?:([a-zA-Z0-9_]+):(\d+)>/,
  EMOJI_UNICODE: /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/,
  URL: /^https?:\/\/[^\s]+$/,
  DISCORD_ID: /^\d{17,19}$/
};

function parseUserMention(str) {
  if (!str) return null;
  const match = str.match(PATTERNS.USER_MENTION);
  return match ? match[1] : null;
}

function parseChannelMention(str) {
  if (!str) return null;
  const match = str.match(PATTERNS.CHANNEL_MENTION);
  return match ? match[1] : null;
}

function parseRoleMention(str) {
  if (!str) return null;
  const match = str.match(PATTERNS.ROLE_MENTION);
  return match ? match[1] : null;
}

function isValidDiscordId(str) {
  return PATTERNS.DISCORD_ID.test(str);
}

function isValidUrl(str) {
  return PATTERNS.URL.test(str);
}

function isValidEmoji(str) {
  return PATTERNS.EMOJI_CUSTOM.test(str) || PATTERNS.EMOJI_UNICODE.test(str);
}

function validatePositiveInteger(value, options = {}) {
  const { fieldName = 'value', min = 1, max = Infinity } = options;
  const num = parseInt(value);
  
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number!` };
  }
  
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}!` };
  }
  
  if (num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}!` };
  }
  
  return { valid: true, value: num };
}

function validatePositiveNumber(value, options = {}) {
  const { fieldName = 'value', min = 0, max = Infinity, allowZero = false } = options;
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number!` };
  }
  
  if (!allowZero && num <= 0) {
    return { valid: false, error: `${fieldName} must be positive!` };
  }
  
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}!` };
  }
  
  if (num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}!` };
  }
  
  return { valid: true, value: num };
}

function validateString(value, options = {}) {
  const { fieldName = 'value', minLength = 1, maxLength = 255, pattern = null, allowEmpty = false } = options;
  
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string!` };
  }
  
  if (!allowEmpty && value.trim().length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty!` };
  }
  
  if (value.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters!` };
  }
  
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} cannot exceed ${maxLength} characters!` };
  }
  
  if (pattern && !pattern.test(value)) {
    return { valid: false, error: `${fieldName} format is invalid!` };
  }
  
  return { valid: true, value: value.trim() };
}

function validateEnum(value, allowedValues, fieldName = 'value') {
  const lowerValue = typeof value === 'string' ? value.toLowerCase() : value;
  
  if (!allowedValues.includes(lowerValue)) {
    return { 
      valid: false, 
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}` 
    };
  }
  
  return { valid: true, value: lowerValue };
}

function validateCurrency(value) {
  return validateEnum(value, ['coins', 'gems'], 'Currency');
}

function validateCrateType(value) {
  return validateEnum(value, ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'], 'Crate type');
}

function validateRarity(value) {
  return validateEnum(value, ['common', 'uncommon', 'rare', 'epic', 'legendary'], 'Rarity');
}

function validateCommandArgs(args, schema) {
  const results = {};
  const errors = [];
  
  for (const [index, rule] of schema.entries()) {
    const value = args[index];
    const { name, type, required = false, options = {} } = rule;
    
    if (!value && required) {
      errors.push(`Missing required argument: ${name}`);
      continue;
    }
    
    if (!value && !required) {
      results[name] = options.default !== undefined ? options.default : null;
      continue;
    }
    
    let validation;
    switch (type) {
      case 'user':
        const userId = parseUserMention(value);
        validation = userId 
          ? { valid: true, value: userId }
          : { valid: false, error: `${name} must be a valid user mention!` };
        break;
      case 'integer':
        validation = validatePositiveInteger(value, { fieldName: name, ...options });
        break;
      case 'number':
        validation = validatePositiveNumber(value, { fieldName: name, ...options });
        break;
      case 'string':
        validation = validateString(value, { fieldName: name, ...options });
        break;
      case 'enum':
        validation = validateEnum(value, options.values || [], name);
        break;
      case 'currency':
        validation = validateCurrency(value);
        break;
      case 'crate':
        validation = validateCrateType(value);
        break;
      case 'rarity':
        validation = validateRarity(value);
        break;
      default:
        validation = { valid: true, value };
    }
    
    if (!validation.valid) {
      errors.push(validation.error);
    } else {
      results[name] = validation.value;
    }
  }
  
  return {
    valid: errors.length === 0,
    results,
    errors
  };
}

module.exports = {
  PATTERNS,
  parseUserMention,
  parseChannelMention,
  parseRoleMention,
  isValidDiscordId,
  isValidUrl,
  isValidEmoji,
  validatePositiveInteger,
  validatePositiveNumber,
  validateString,
  validateEnum,
  validateCurrency,
  validateCrateType,
  validateRarity,
  validateCommandArgs
};
