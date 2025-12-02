# Discord Character Collection Bot

## Overview
This project is a Discord bot focused on character collection, featuring over 50 unique characters with stats, leveling, and a skin system. It includes a comprehensive economy with multiple currencies, a dynamic battle system, interactive elements like crates and random drops, player trading, and competitive daily events. The bot aims to boost community engagement and offer a persistent, captivating virtual world for users. It also incorporates multi-game support, allowing servers to select specific character bundles, and robust anti-cheat and moderation systems for a fair and safe environment.

## Recent Refactoring Updates (December 2025)

### Architecture Improvements
- **Command Handler System:** Created modular command handler structure in `commands/` directory with category-based organization (economy, characters, battle, social, work, admin, moderation)
- **Shared Utilities:** Consolidated duplicate code into reusable modules:
  - `utils/shared.js` - Common functions (generateST, formatNumber, cooldown management, safe reply helpers)
  - `utils/validation.js` - Input validation (user mentions, positive numbers, enums, command args)
  - `utils/embeds.js` - Standardized embed creation for errors, success, and info messages
  - `utils/errorHandler.js` - Centralized error types, logging, and safe error handling
  - `utils/logger.js` - Structured logging with categories and log levels
- **Configuration Centralization:** Created `config.js` with all bot constants (cooldowns, limits, economy values, anti-cheat thresholds, colors, messages)

### Critical Bug Fixes
- **generateST() Fix:** Fixed critical bug where generateST() returned 6-character string instead of numeric value (0-100). Now correctly returns `parseFloat((Math.random() * 100).toFixed(2))`
- **MongoDB Graceful Fallback:** Bot now runs in JSON-only mode when USE_MONGODB is not set, allowing local testing without MongoDB dependency

### Code Quality
- **Error Handling:** Created standardized BotError class with error types (VALIDATION, DATABASE, DISCORD_API, PERMISSION, etc.)
- **Logging:** Implemented structured logging with categories (SYSTEM, COMMAND, DATABASE, BOT, SECURITY) and log levels (DEBUG, INFO, WARN, ERROR, FATAL)
- **Input Validation:** Comprehensive validation utilities for Discord mentions, positive integers/numbers, strings, enums, currencies, crate types, and rarities

### Key Files Added/Modified
```
commands/
  commandHandler.js     # Modular command loader and registration
  economy/
    daily.js, balance.js, shop.js
  characters/
    collection.js
  battle/
    battle.js
  social/
    profile.js
  work/
    work.js
  admin/
    give.js
  moderation/
    warn.js

utils/
  shared.js             # generateST(), formatNumber(), cooldowns, safe reply
  validation.js         # Input validation, mention parsing, command args
  embeds.js             # Standardized embed creators
  errorHandler.js       # BotError class, error logging, safe handlers
  logger.js             # Structured logging with levels and categories

config.js               # Centralized bot configuration
```

## Website (December 2025)
The project includes a professional public website:

**Public Pages (public/ folder):**
- `/` or `/index.html` - Landing page with features overview
- `/features.html` - Detailed feature breakdown
- `/guide.html` - Complete player guide with commands
- `/changelog.html` - Version history and updates
- `/about.html` - About ZooBot and team info

**API Endpoints:**
- `GET /api/stats` - Bot statistics
- `GET /api/changelog` - Changelog entries
- `GET /health` - Health check

## Seasonal Events System (December 2025)
A comprehensive rotating season pass system to drive player engagement:

**Season Configuration:**
- **Duration:** 2 weeks per season, auto-rotates every Monday at 00:00 UTC
- **Themes:** Winter (Dec-Feb), Spring (Mar-May), Summer (Jun-Aug), Autumn (Sep-Nov)
- Each season has unique colors, emojis, and themed rewards

**Season Pass (40 Levels):**
- Escalating point requirements (Level 1: 100 pts, Level 40: ~2,950 pts)
- Milestone rewards at levels 5, 10, 15, 20, 25, 30, 35, 40
- Rewards include coins, gems, shards, crates, ST boosters, and UST
- Grand prize at Level 40: Tyrant Crate + ST Booster + 100 UST

**Daily Tasks System:**
- 5 tasks per day: 2 Easy (10-15 pts), 2 Medium (25-35 pts), 1 Hard (50-75 pts)
- Tasks reset at 00:00 UTC (5:30 AM IST)
- Random task selection using seeded RNG for consistency
- Task types: catchDrops, winBattles, openCrates, tradePlayers, earnCoins, etc.

**Lure Messaging:**
- All season commands show upcoming milestone rewards
- Messages like "A reward is waiting at Level X!" to encourage progress
- Progress bars and visual feedback for motivation

**Season Commands:**
- `!season` / `!seasonpass` / `!sp` - View season pass progress
- `!seasontasks` / `!dailytasks` / `!dt` - View daily tasks
- `!seasonrewards` / `!srewards` - View all milestone rewards
- `!taskclaimall` / `!tclaim` - Claim completed task rewards
- `!seasonclaimall` / `!sclaim` - Claim unlocked season rewards

## Interactive Hub System (December 2025)
A button-based navigation system to make the bot accessible without memorizing commands:

**Core Files:**
- `hubSystem.js` - Main hub menu with categorized navigation
- `onboardingSystem.js` - First-time user tutorial with step-by-step guidance
- `discoverySystem.js` - Tracks feature usage and suggests unexplored features
- `hubInteractionHandler.js` - Handles all button/menu interactions

**Hub Categories:**
- **Play** (🎮): Quick actions - Daily rewards, Random Drop, Quick Battle
- **Collection** (🦁): Character management - My Collection, View All Characters, Skins
- **Battle** (⚔️): Combat features - PvP Battle, AI Battle, Energy/Inventory
- **Economy** (💰): Money features - Balance, Shop, Daily/Work
- **Social** (🤝): Community - Profile, Leaderboards, Trading, Clan
- **Progression** (📈): Advancement - Quests, Achievements, Season Pass
- **Fun** (🎲): Mini-games - Trivia, Minigames, Lottery

**Hub Commands:**
- `!hub` / `!menu` - Open main navigation hub
- `!guide` - Quick start guide with visual walkthrough

**Features:**
- One-click access to all major features via buttons
- Feature discovery tracking - encourages exploration
- Onboarding tutorial for new players (triggered on first !start)
- Hub buttons integrated into profile and collection views
- No command memorization required

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, using a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script.

**UI/UX Decisions:**
- **Visuals:** Character skins in embeds, paginated user profiles with progress bars, custom profile picture selection, and custom PFP image system.
- **Progress Bars:** 12-slot colored emoji progress bars with percentage display.
- **Information Display:** Extensive use of Discord embeds and emoji integration.

**Technical Implementations:**
- **Character System:** 50+ unique characters with tokens, traits, moves, HP scaling, levels, and skins. New characters can be dynamically created with default abilities if none are specified.
- **Economy & Currency:** Coins, Gems, Trophies, and Character-specific Tokens, with various reward mechanisms.
- **Crate System:** Multi-tiered crates offering characters, tokens, and coins, with interactive opening.
- **Drop System:** Random token, coin, and gem drops with optimization for reduced API calls and smart pausing.
- **Trading & Market System:** Secure player-to-player trading, and a universal marketplace for items (ores, wood, crates, keys, resources) with sequential IDs.
- **Auction System:** Time-based auction system with dual UI (form and text command) supporting all item types and instant MongoDB saves.
- **Battle System:** Turn-based combat with energy management, passive abilities, critical hits, status effects, consumables, and an AI battle system with dynamic difficulty scaling.
- **Inventory:** MongoDB-compatible inventory for battle items.
- **Event System:** Daily rotating competitive events with automatic reward distribution.
- **Giveaway & Lottery System:** Daily giveaways and a universal lottery with ticket purchases and prize accumulation.
- **Promotion System:** Automated promotional messages for non-main servers.
- **Permission System:** Three-tier role-based access control (Super Admin, ZooAdmin Role, Bot Admin).
- **Admin Tools:** Commands for managing resources, characters, skins, emojis, chest GIFs, bot channels, server settings, and bot updates.
- **Key & Cage System:** Two-tier character unlock system using character-specific and random cage keys.
- **Custom Emojis:** Bot-wide custom character emojis stored in MongoDB.
- **Profile Picture (PFP) System:** Custom profile image system allowing users to upload and manage multiple PFPs.
- **Personalized Task System:** Tasks restricted to registered players.
- **Trivia System:** Interactive trivia with admin-manageable question database.
- **Mail System:** Inbox clearing functionality.
- **Work/Job System:** 5 job types with a 15-minute cooldown, rewarding various items. Includes a free starter pack for new workers.
- **Resource Economy:** 5 ore types and 4 wood types for crafting and trading.
- **Tool Crafting:** 4 tool types with 5 levels each, crafted from ores and wood, improving job rewards.
- **Caretaking House:** 5-level upgrade system for the caretaker job.
- **Work Guide System:** In-bot documentation for jobs, tools, crafting, and market.
- **Work Image System:** CDN-hosted custom images for each work type.
- **Admin Economy Tools:** Super admin commands for resource, market, and auction management.
- **Universal Skin Token (UST) System:** Cosmetics economy for earning and spending UST on character skins and profile pictures, earned via clan wars. Features a shop, rarity tiers, and admin upload commands.
- **Character Info Command (`!info`):** View character details without owning them.
- **Force Release Command (`!forcerelease`):** Super admin command to release any character.
- **Q&A System:** Comprehensive Q&A with user submission, admin approval, and MongoDB storage.
- **Game/Bundle System:** Multi-game support allowing servers to select specific character bundles for drops and crates. Includes admin commands for game and character management.
- **Character Submission System:** Player-created character submission workflow with admin review, approval/rejection, and auto-creation.
- **Server Setup Enhanced:** Setup now requires game selection, drop channel, event channel, and update channel configuration, with status checks and validation.
- **Anti-Cheat System:** Rate limiting, suspicious activity detection, transaction logging, and user snapshots for potential rollback.
- **Moderation System:** Full moderation toolkit for ZooAdmins including warning, bot ban, mute, message management, and logging.

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