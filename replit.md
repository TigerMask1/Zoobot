# Discord Character Collection Bot

## Overview
This project is a Discord bot focused on character collection, featuring over 50 unique characters with stats, leveling, and a skin system. It includes a comprehensive economy with multiple currencies, a dynamic battle system, interactive elements like crates and random drops, player trading, and competitive daily events. The bot aims to boost community engagement and offer a persistent, captivating virtual world for users, incorporating multi-game support and robust anti-cheat and moderation systems for a fair and safe environment.

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, using a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script. It features a modular command handler, centralized configuration, and shared utility functions for validation, embeds, error handling, and logging.

**UI/UX Decisions:**
- **Visuals:** Character skins in embeds, paginated user profiles with progress bars, custom profile picture selection, and custom PFP image system.
- **Progress Bars:** 12-slot colored emoji progress bars with percentage display.
- **Information Display:** Extensive use of Discord embeds and emoji integration.

**Technical Implementations:**
- **Character System:** 50+ unique characters with tokens, traits, moves, HP scaling, levels, and skins, with dynamic character creation and a player submission system.
- **Economy & Currency:** Multiple currencies (Coins, Gems, Trophies, Character Tokens, UST) with various reward mechanisms.
- **Interactive Systems:** Multi-tiered crate system, random token/coin/gem drops, secure player trading, universal marketplace, time-based auction system, and character key collection system.
- **Character Key System:** Players collect keys for specific characters (750 keys to unlock). Includes Key Rush events (1-hour key-only drops), auto-conversion of excess keys to tokens for owned characters, and scheduled daily Key Rush hours in the main server.
- **Battle System:** Turn-based combat with energy management, passive abilities, critical hits, status effects, consumables, and an AI battle system with dynamic difficulty.
- **Seasonal Events:** A rotating season pass system with daily tasks, milestone rewards, and themed content.
- **Interactive Hub System:** Button-based navigation for all bot features, categorized player and admin panels, onboarding tutorials, and feature discovery.
- **Inventory & Collection:** MongoDB-compatible inventory for battle items, character collection management, and custom emoji support.
- **Event Management:** Daily rotating competitive events, giveaways, and a universal lottery system.
- **Work System:** Five job types with cooldowns, rewarding various items, supported by a resource economy (ores, wood) and tool crafting system (4 tool types, 5 levels).
- **Customization:** Custom profile picture system and Universal Skin Token (UST) system for cosmetics.
- **Information & Engagement:** Character info command, comprehensive Q&A system with user submission, and a mail system.
- **Server-Based Character System:** Each server is self-contained with their own characters and collectibles. Servers create/add characters that appear in their drops and crates (no predefined bundles for community servers).
- **Permission System:** Five-tier role hierarchy (Super Admin, Global Bot Admin, Server Owner, Server Admin, ZooAdmin, Player) with granular access control.
- **Admin Tools:** Extensive commands for managing resources, characters, skins, emojis, server settings, and bot updates.
- **Anti-Cheat & Moderation:** Rate limiting, suspicious activity detection, transaction logging, user snapshots, and a full moderation toolkit with hierarchical permission checks.
- **Server Customization:** Per-server feature toggles and ping settings for drops, events, giveaways, lottery, and updates with role-based mentions.

**System Design Choices:**
- **Modularity & Scalability:** Core functionalities separated into dedicated files, designed for MongoDB integration.
- **Data Management:** Automatic data backfilling, environment-based configuration, dual-save system, and graceful shutdown.
- **Error Handling:** Comprehensive error handling with user-friendly messages.
- **Performance Optimization:** In-memory caching, MongoDB indexes, and optimized Discord API calls.
- **Security:** Role-based access control for critical commands and server customization.
- **Multi-Server Architecture:** Supports deployment across multiple Discord servers with differentiated features.

## External Dependencies
- **Discord.js v14**: Discord API interactions.
- **Node.js 20**: JavaScript runtime environment.
- **Express**: Lightweight HTTP server for health checks.
- **MongoDB**: Production data persistence.

## Recent Changes (December 2025)

### Character Key System Implementation
Added a new character key collection system as an alternative way to unlock characters:

**New Commands:**
- `!charkeys` / `!ck` - View your character key collection with progress bars
- `!keyunlock <character>` - Unlock a character using 750 keys
- `!convertkeys` - Convert excess keys for owned characters to tokens (1:1)
- `!keyrush` - Activate Key Rush event (250 gems, 1 hour) - ZooAdmin only
- `!keyrushstatus` - Check if Key Rush is currently active
- `!grantkeyrush [serverId]` - Grant free Key Rush - Super Admin only

**Key Features:**
- Character keys drop during Key Rush events (all drops become keys)
- 750 keys required to unlock any character
- Keys follow server's selected game bundle
- Auto-conversion of excess keys to tokens when catching key drops for owned chars
- Scheduled daily Key Rush hours at 10:00, 16:00, and 22:00 in the main server
- Interactive paginated menu with select dropdown for character details

**Files Modified:**
- `characterKeySystem.js` - New file with all key system logic
- `dropSystem.js` - Added Key Rush drop type support
- `index.js` - Integrated commands, handlers, and scheduler initialization

### Bug Fixes & Improvements (December 2025)

**ZooAdmin Role Detection Fix:**
- Fixed `isZooAdmin()` function calls that were passing wrong arguments
- Now properly checks `message.member` instead of `(message, serverId)`
- Super Admins and Bot Admins can also use ZooAdmin commands

**Character Key Normal Drops:**
- Added 5% chance for character keys to drop during normal gameplay
- Drops 1-2 keys when triggered (between shards and tokens in rarity)
- Keys follow the server's selected game bundle

**New Super Admin Command:**
- `!grantkeys @user <character> <amount>` - Grant character keys to any user
- Supports multi-word character names (e.g., "Donna the Diva")

**Giveaway System Fix:**
- Fixed critical bug where rewards weren't being saved properly
- Changed incorrect `saveData.giveaway` to `data.giveaway`

**Hub Documentation Updated:**
- Added character keys information to rewards section
- Added `!grantkeys` and `!grantkeyrush` to admin commands

### UTC Scheduling & Event System Improvements (December 2025)

**Lottery & Giveaway UTC Scheduling:**
- Lottery runs every 12 hours at 00:00 and 12:00 UTC
- Giveaway runs every 24 hours at 00:00 UTC
- Both use channel 1445441639064801322 as default
- Multi-server support: single global scheduler iterates all servers
- Prevention of duplicate automatic triggers (skips if already active)

**KeyRush Event Improvements:**
- Now runs in main drops channel (uses server's configured dropChannelId)
- Pings Event role on start notification
- Auto-revives paused drops before event starts
- Auto-resumes drops after event ends (respects dropsWerePausedBefore flag)
- Graceful error handling for drop resumption

**Technical Notes:**
- `startUTCLotteryScheduler()` - Global minute-based checker for all servers
- `startUTCGiveawayScheduler()` - Global minute-based checker for giveaways
- `dropsWerePausedBefore` flag prevents unwanted drop restarts
- All critical saves use `saveDataImmediate()` for data integrity

### Web Dashboard Complete Redesign (December 2025)

**Full Configuration Dashboard:**
The dashboard has been completely redesigned as a fully functional bot configuration system with proper MongoDB persistence for all settings.

**New Server Configuration Schema:**
- `core` - Bot prefix, slash commands, disabled commands, command cooldowns
- `permissions` - ZooAdmin role, admin/moderator/trusted/blocked role IDs
- `channels` - Drop, events, updates, battle, log, giveaway, welcome, announcement channels
- `features` - 22 feature toggles (drops, events, trading, battles, etc.)
- `notificationSettings` - Ping toggles and role IDs for each notification type
- `moderationSettings` - Auto-mod, profanity filter mode, warning thresholds, mute/ban durations
- `economySettings` - Earn rates, drop rates, reward multipliers, marketplace fees
- `onboardingSettings` - Welcome messages, auto-roles, verification
- `automationSettings` - Timezone, locale, scheduled jobs
- `audit` - Schema version, change log

**Dashboard UI Panels:**
- Core Settings - Command prefix, ZooAdmin role name, slash commands toggle
- Channel Configuration - 8 channel dropdowns with live Discord data
- Feature Toggles - 18 toggleable features with descriptions
- Notification Settings - 5 ping toggles with role selection
- Moderation Settings - Auto-mod, profanity filter, warning limits
- Economy Settings - Daily/work rewards, multipliers, fees
- Welcome/Onboarding - Welcome toggle, custom message with placeholders

**API Routes (PATCH endpoints):**
- `/admin/api/servers/:serverId/core` - Update core settings
- `/admin/api/servers/:serverId/permissions` - Update permissions
- `/admin/api/servers/:serverId/channels` - Update channels
- `/admin/api/servers/:serverId/features` - Update feature toggles
- `/admin/api/servers/:serverId/notifications` - Update notifications
- `/admin/api/servers/:serverId/moderation` - Update moderation
- `/admin/api/servers/:serverId/economy` - Update economy
- `/admin/api/servers/:serverId/onboarding` - Update onboarding
- `/admin/api/servers/:serverId/config` - Get full configuration

**Input Validation:**
- `dashboard/validation.js` - Comprehensive validation for all settings
- Validates Discord IDs, prefixes, numbers, booleans, enums
- Returns structured error messages for invalid inputs

**Real-Time Bot Sync:**
- Dashboard changes emit `dashboardConfigUpdate` events
- Bot handler processes 15 config update types
- Reloads server config from MongoDB after dashboard updates
- Settings apply immediately without bot restart

**Default Backfilling:**
- `getServerConfig()` merges defaults for missing nested fields
- Existing documents get proper defaults for new schema fields
- No migration needed for old server configs

**Files Modified:**
- `dashboard/schemas.js` - Comprehensive SERVER_CONFIG_SCHEMA and DEFAULT_* constants
- `dashboard/database.js` - New CRUD functions for all settings categories
- `dashboard/routes/servers.js` - New PATCH routes with validation
- `dashboard/validation.js` - New validation utility
- `public/dashboard.html` - Complete UI redesign with settings panels
- `index.js` - Expanded dashboardConfigUpdate event handler
- `serverConfigManager.js` - Added reloadServerConfigFromMongo function