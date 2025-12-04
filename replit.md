# Discord Character Collection Bot

## Overview
This Discord bot aims to boost community engagement by offering a persistent, captivating virtual world for users to collect and battle with over 50 unique characters. It features a comprehensive economy, dynamic battle system, interactive elements like crates and drops, player trading, and competitive events. The project emphasizes multi-game support, robust anti-cheat, and moderation systems to ensure a fair and safe environment.

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, utilizing a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script. It features a modular command handler, centralized configuration, and shared utility functions.

**UI/UX Decisions:**
- **Visuals:** Character skins in embeds, paginated user profiles with progress bars, custom profile picture selection.
- **Progress Bars:** 12-slot colored emoji progress bars with percentage display.
- **Information Display:** Extensive use of Discord embeds and emoji integration.

**Technical Implementations:**
- **Character System:** 50+ unique characters with traits, moves, HP scaling, levels, and skins; dynamic character creation and a player submission system.
- **Economy & Currency:** Multiple currencies (Coins, Gems, Trophies, Character Tokens, UST) with various reward mechanisms.
- **Interactive Systems:** Multi-tiered crate system, random drops, secure player trading, universal marketplace, time-based auction system, and character key collection.
- **Battle System:** Turn-based combat with energy management, passive abilities, critical hits, status effects, consumables, and an AI battle system.
- **Seasonal Events:** Rotating season pass with daily tasks and milestone rewards.
- **Interactive Hub System:** Button-based navigation, categorized player/admin panels, onboarding tutorials.
- **Inventory & Collection:** MongoDB-compatible inventory for battle items and character collection.
- **Event Management:** Daily rotating competitive events, giveaways, and a universal lottery system.
- **Work System:** Five job types with cooldowns, resource economy (ores, wood), and tool crafting.
- **Customization:** Custom profile picture system and Universal Skin Token (UST) for cosmetics.
- **Information & Engagement:** Character info command, comprehensive Q&A system, and a mail system.
- **Multi-Game Support:** Allows servers to select specific character bundles.
- **Permission System:** Five-tier role hierarchy with granular access control.
- **Admin Tools:** Commands for managing resources, characters, skins, emojis, server settings, and bot updates.
- **Anti-Cheat & Moderation:** Rate limiting, suspicious activity detection, transaction logging, user snapshots, and a full moderation toolkit.
- **Server Customization:** Per-server feature toggles and ping settings.

**System Design Choices:**
- **Modularity & Scalability:** Core functionalities separated for maintainability and MongoDB integration.
- **Data Management:** Automatic data backfilling, environment-based configuration, dual-save system, graceful shutdown.
- **Error Handling:** Comprehensive error handling with user-friendly messages.
- **Performance Optimization:** In-memory caching, MongoDB indexes, and optimized Discord API calls.
- **Security:** Role-based access control for critical commands.
- **Multi-Server Architecture:** Supports deployment across multiple Discord servers.

## External Dependencies
- **Discord.js v14**: Discord API interactions.
- **Node.js 20**: JavaScript runtime environment.
- **Express**: Lightweight HTTP server for health checks and web dashboard.
- **MongoDB**: Production data persistence.
- **React + Vite**: Web dashboard frontend.
- **Tailwind CSS v3**: Dashboard styling.

## Recent Changes (December 2025)

**Work Command Fix:**
- Added missing `!work` command handler in index.js
- Command now properly integrates with workSystem.js functions
- Players can work jobs (Miner, Caretaker, Farmer, Zookeeper, Ranger) with 15-minute cooldowns

**Upload Skin Fix:**
- Fixed `!uploadskin` command that was throwing an error
- Updated `addSkinToCatalog()` function to accept and use the `isExclusive` parameter
- Added missing `RARITY_EMOJIS` import in the command handler to fix undefined variable error

**Lottery Double Announcement Fix:**
- Fixed race condition causing lottery to announce results twice
- Added `drawInProgress` mutex lock to prevent concurrent draw operations
- Lock only acquired after confirming Discord client is ready

**Missing Command Handlers Fix (December 4, 2025):**
- Added missing case statements for game/bundle management: `!setgame`, `!creategame`, `!newgame`, `!createbundle`
- Added missing case statements for game listing: `!games`, `!gamelist`, `!bundles`
- Added missing case statements for character listing: `!listchars`, `!allchars`, `!characters`, `!charlist`
- Added character submission commands: `!submit`, `!submitchar`, `!pendingchars`, `!approvesubmit`, `!rejectsubmit`
- Added setup status command: `!setupstatus`, `!serverstatus`
- Fixed `!listchars` to filter by server's selected game instead of showing all characters
- Fixed `!games` to paginate results and prevent exceeding Discord embed limits
- Restricted character submission approval/rejection to Super Admins only (matching character creation permissions)
- Fixed variable name conflicts (renamed statusEmbed, gameFilter to avoid redeclaration errors)