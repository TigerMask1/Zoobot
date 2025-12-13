# Discord Character Collection Bot

## Overview
This Discord bot facilitates character collection with over 50 unique characters, each featuring stats, leveling, and a skin system. It incorporates a comprehensive economy with multiple currencies, a dynamic battle system, interactive elements like crates and random drops, player trading, and competitive daily events. The bot aims to boost community engagement, offer a persistent virtual world, provide multi-game support, and maintain a fair environment with robust anti-cheat and moderation systems. Its core purpose is to create an engaging and lasting experience for Discord communities through a rich character collection and progression system.

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, utilizing a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script. It features a modular command handler, centralized configuration, and shared utility functions for validation, embeds, error handling, and logging. The system supports multi-server deployment with differentiated features and offers extensive customization.

**UI/UX Decisions:**
- **Visuals:** Character skins in embeds, paginated user profiles with progress bars, custom profile picture selection.
- **Progress Bars:** 12-slot colored emoji progress bars with percentage display.
- **Information Display:** Extensive use of Discord embeds and emoji integration.

**Technical Implementations:**
- **Character System:** 50+ unique characters with tokens, traits, moves, HP scaling, levels, and skins, supporting dynamic character creation and player submissions.
- **Economy & Currency:** Multiple currencies (Coins, Gems, Trophies, Character Tokens, UST) with various reward mechanisms.
- **Interactive Systems:** Multi-tiered crate system, random token/coin/gem drops, secure player trading, universal marketplace, time-based auction, and a character key collection system (750 keys to unlock, Key Rush events, auto-conversion).
- **Battle System:** Turn-based combat with energy management, passive abilities, critical hits, status effects, consumables, and an AI battle system with dynamic difficulty.
- **Seasonal Events:** Rotating season pass with daily tasks and milestone rewards.
- **Interactive Hub System:** Button-based navigation for all bot features, categorized panels, onboarding tutorials.
- **Inventory & Collection:** MongoDB-compatible inventory for battle items and character collection.
- **Event Management:** Daily rotating competitive events, giveaways, and a universal lottery system.
- **Work System:** Five job types with cooldowns, resource economy (ores, wood), and tool crafting.
- **Customization:** Custom profile pictures and Universal Skin Token (UST) system.
- **Information & Engagement:** Character info commands, Q&A system, and a mail system.
- **Server-Based Character System:** Each server manages its own characters and collectibles, which appear in drops and crates.
- **Permission System:** Five-tier role hierarchy with granular access control.
- **Admin Tools:** Commands for managing resources, characters, skins, emojis, server settings, and bot updates.
- **Anti-Cheat & Moderation:** Rate limiting, suspicious activity detection, transaction logging, user snapshots, and a full moderation toolkit.
- **Server Customization:** Per-server feature toggles and ping settings for drops, events, giveaways, lottery, and updates with role-based mentions.
- **Web Dashboard:** A fully functional configuration dashboard with MongoDB persistence for all server settings, including core, permissions, channels, features, notifications, moderation, economy, onboarding, and automation. Features real-time bot sync via events.
- **Setup Wizard:** An interactive `!setup` command guiding server owners through essential configuration steps.
- **Global Character Directory:** A paginated `!chars` command displaying public characters from all servers, allowing users to view details and add characters to their own server, complete with an approval workflow for public characters.

**System Design Choices:**
- **Modularity & Scalability:** Core functionalities separated into dedicated files, designed for MongoDB integration.
- **Data Management:** Automatic data backfilling, environment-based configuration, dual-save system, and graceful shutdown.
- **Error Handling:** Comprehensive error handling with user-friendly messages.
- **Performance Optimization:** In-memory caching, MongoDB indexes, and optimized Discord API calls.
- **Security:** Role-based access control for critical commands and server customization.

**Aura System:** All commands automatically award 1 aura point to the server. Specific actions award bonus aura (drops: 5, battles: 3-8, crates: 4, daily: 10, work: 3, etc.).

**Auto-Backfill:** On startup, the bot automatically seeds the main server (ID: 1430516117851340893) with all ZooBot original characters and default collectibles if they don't already exist.

## External Dependencies
- **Discord.js v14**: For all Discord API interactions.
- **Node.js 20**: The JavaScript runtime environment.
- **Express**: Used for a lightweight HTTP server, primarily for health checks and the web dashboard.
- **MongoDB**: The primary database for production data persistence and server configurations.