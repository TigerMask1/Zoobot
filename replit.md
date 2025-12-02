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
- **Interactive Systems:** Multi-tiered crate system, random token/coin/gem drops, secure player trading, universal marketplace, and a time-based auction system.
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
- **Express**: Lightweight HTTP server for health checks.
- **MongoDB**: Production data persistence.