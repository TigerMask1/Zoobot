const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const LOG_LEVEL_NAMES = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'FATAL'
};

const LOG_COLORS = {
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  FATAL: '\x1b[35m',
  RESET: '\x1b[0m'
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

function formatTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, category, message, data = null) {
  const color = LOG_COLORS[LOG_LEVEL_NAMES[level]];
  const reset = LOG_COLORS.RESET;
  const timestamp = formatTimestamp();
  const levelName = LOG_LEVEL_NAMES[level];
  
  let output = `${color}[${timestamp}] [${levelName}]${reset} [${category}] ${message}`;
  
  if (data !== null) {
    if (typeof data === 'object') {
      output += `\n${JSON.stringify(data, null, 2)}`;
    } else {
      output += ` ${data}`;
    }
  }
  
  return output;
}

function log(level, category, message, data = null) {
  if (level < currentLogLevel) return;
  console.log(formatMessage(level, category, message, data));
}

const logger = {
  debug: (category, message, data) => log(LOG_LEVELS.DEBUG, category, message, data),
  info: (category, message, data) => log(LOG_LEVELS.INFO, category, message, data),
  warn: (category, message, data) => log(LOG_LEVELS.WARN, category, message, data),
  error: (category, message, data) => log(LOG_LEVELS.ERROR, category, message, data),
  fatal: (category, message, data) => log(LOG_LEVELS.FATAL, category, message, data),
  
  system: (message, data) => log(LOG_LEVELS.INFO, 'SYSTEM', message, data),
  command: (commandName, userId, message, data) => 
    log(LOG_LEVELS.DEBUG, 'COMMAND', `${commandName} by ${userId}: ${message}`, data),
  database: (operation, message, data) => 
    log(LOG_LEVELS.DEBUG, 'DATABASE', `${operation}: ${message}`, data),
  bot: (event, message, data) => 
    log(LOG_LEVELS.INFO, 'BOT', `${event}: ${message}`, data),
  security: (event, userId, details) =>
    log(LOG_LEVELS.WARN, 'SECURITY', `${event} by ${userId}`, details)
};

function createCategoryLogger(category) {
  return {
    debug: (message, data) => logger.debug(category, message, data),
    info: (message, data) => logger.info(category, message, data),
    warn: (message, data) => logger.warn(category, message, data),
    error: (message, data) => logger.error(category, message, data),
    fatal: (message, data) => logger.fatal(category, message, data)
  };
}

module.exports = {
  LOG_LEVELS,
  logger,
  createCategoryLogger
};
