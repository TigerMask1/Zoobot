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
- **Multi-Game Support:** Allows servers to select specific character bundles for drops and crates.
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
- **Express**: Lightweight HTTP server for health checks and web dashboard.
- **MongoDB**: Production data persistence.
- **React + Vite**: Web dashboard frontend.
- **Tailwind CSS v3**: Dashboard styling.

## Web Dashboard

The project includes a modern web dashboard for managing bot settings without typing commands.

**Dashboard Features:**
- Discord OAuth2 login with PKCE security
- Server management (for Discord server admins)
- Character bundle selection
- Character submission system
- Account preferences

**Dashboard Setup:**
1. Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` environment variables
2. Add the OAuth2 redirect URI to your Discord app: `https://your-domain/auth/discord/callback`
3. The dashboard is served automatically at the root URL

**Dashboard Files:**
- `website/` - React frontend source code
- `website/dist/` - Built dashboard files (auto-served)
- OAuth2 routes integrated in `index.js`

**Environment Variables for Dashboard:**
- `DISCORD_CLIENT_ID` - Discord application client ID
- `DISCORD_CLIENT_SECRET` - Discord application client secret
- `COOKIE_SECRET` (optional) - Secret for signing cookies

## Recent Changes (December 2025)

### Web Dashboard Implementation
Added a modern React-based web dashboard with Discord OAuth2 authentication:
- Clean, responsive UI built with React and Tailwind CSS
- Secure Discord OAuth2 with PKCE flow
- OAuth2 redirect URI correctly uses REPLIT_DEV_DOMAIN for reliable redirects
- Integrated into main server on port 5000 (no separate server needed)
- Server management, bundles, and character submissions
- Works independently even if Discord bot token is not set

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

**Critical Giveaway Scheduling Fix (December 2025):**
- Fixed `TypeError: now.getUTCFullYear is not a function` crash
- Root cause: `Date.now()` returns a number, but code was calling Date methods on it
- Fixed all occurrences in `scheduleNextAutoGiveaway()`, `startAutomaticGiveaway()`, and `initializeGiveawaySystem()`
- Changed `const now = Date.now()` to `const nowDate = new Date()` where Date methods are needed
- This fix prevents the crash loop that was causing duplicate giveaways

**Index.js Syntax Fixes:**
- Fixed unescaped backtick in template string (line ~4292)
- Renamed duplicate variable `stopResult` to `stopEventResult`
- Fixed corrupted code at end of file

**Hub Documentation Updated:**
- Added character keys information to rewards section
- Added `!grantkeys` and `!grantkeyrush` to admin commands

**Giveaway Deleted Message Handling (December 2025):**
- Fixed "Unknown Message" errors when giveaway messages are deleted
- Added graceful error handling for channel.fetch() and messages.fetch() calls
- Auto-detects and cleans up stale giveaway data on bot restart
- Prevents auto-giveaway conflicts when manual giveaway is running
- If winner message is deleted, posts new winner announcement instead of crashing

**Lottery Double Message Fix (December 2025):**
- Fixed issue where auto-lottery was sending 2 messages when ending
- Modified `broadcastToAllServers` to skip channels that match the lottery channel
- Prevents duplicate announcements when lottery channel equals events channel

**Key Rush Drop Channel Fix (December 2025):**
- Fixed bug where `MAIN_SERVER_ID` was incorrectly used as channel ID fallback
- Added `MAIN_DROP_CHANNEL` constant for proper channel targeting
- Added `EXCLUDED_DROP_CHANNEL` (1430525428312965160) to prevent drops in that channel
- Key Rush drops now correctly go to the main drop channel (1430525383635107850)
- Start/End notifications still work normally

**Normal Key Drops Increased (December 2025):**
- Increased character key drop rate from 5% to 15% during normal gameplay
- Updated drop distribution: 2% shards, 15% keys, 45% tokens, 30% coins, 8% gems

**Key Rush & Revive Command Fix (December 2025):**
- Fixed bug where `!revive` said "drops are already active" during Key Rush
- Root cause: When Key Rush starts, normal drops are stopped but inactivity status wasn't updated
- The revive command only checked `status.paused` which was false, even though drops weren't running
- Fix 1: `reviveDrops()` now checks if Key Rush is active and shows appropriate message
- Fix 2: `reviveDrops()` now checks if drops are actually running (via `dropIntervals` Map)
- Fix 3: When Key Rush ends, inactivity status is now reset to prevent immediate pause
- Fix 4: **AUTO-REVIVE** - When Key Rush starts (scheduled, manual, or granted), inactivity is automatically reset
  - This means if drops were paused due to inactivity, they're automatically "revived" when Key Rush starts
  - No need to manually `!revive` before Key Rush anymore
- Added `resetInactivityStatus()` function to properly handle state transitions
- Updated functions: `checkScheduledKeyRush()`, `activateKeyRush()`, `activateKeyRushConfirmed()`, `grantKeyRush()`
- Files modified: `dropSystem.js`, `characterKeySystem.js`