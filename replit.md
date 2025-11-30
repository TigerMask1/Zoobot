# Discord Character Collection Bot

## Overview
This project is a Discord bot offering a comprehensive character collection experience with over 50 unique characters, stats, leveling, and a skin system. It integrates a full economy, dynamic battle system, interactive elements like crates and random drops, player trading, and competitive daily events. The bot aims to enhance community engagement and provide a persistent, engaging virtual world for users. A recent addition is the "Custom Game Mode," allowing server owners to create unique themed games with custom characters while maintaining global economies.

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, utilizing a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script.

**UI/UX Decisions:**
- **Visuals:** Character skins displayed in embeds, paginated user profiles with progress bars, custom profile picture selection, and custom PFP image system.
- **Progress Bars:** 12-slot colored emoji progress bars with percentage display.
- **Information Display:** Extensive use of Discord embeds and emoji integration.

**Technical Implementations:**
- **Character System:** 50+ unique characters with tokens, traits, moves, HP scaling, levels, and owned skins.
- **Economy & Currency:** Multiple currencies (Coins, Gems, Trophies, Character Tokens) with daily login and message-based rewards.
- **Crate System:** Multi-tiered crates offering characters, tokens, and coins, including a "pending tokens" system.
- **Drop System:** Random token, coin, and gem drops with optimization for reduced API calls.
- **Trading System:** Secure player-to-player trading with dual confirmation.
- **Battle System:** Turn-based combat with energy management, passive abilities, critical hits, status effects, consumable items, and AI battles. AI difficulty scales dynamically.
- **Inventory:** MongoDB-compatible inventory for battle items.
- **Event System:** Daily rotating competitive events with real-time tracking and automatic reward distribution.
- **Giveaway & Lottery Systems:** Automated prize distribution and universal lottery with prize pools.
- **Promotion System:** Automated promotional messages for non-main servers.
- **Permission System:** Three-tier role-based access control (Super Admin, ZooAdmin Role, Bot Admin).
- **Admin Tools:** Commands for managing game resources, characters, skins, and bot configuration.
- **Key & Cage System:** Two-tier character unlock system.
- **Custom Emojis:** Bot-wide custom character emojis stored in MongoDB.
- **Profile Picture (PFP) System:** Custom profile image management using Discord CDN URLs.
- **Personalized Task System:** Tasks restricted to registered players.
- **Trivia System:** Interactive trivia with admin-manageable questions.
- **Mail System:** Inbox clearing functionality.
- **Help Documentation:** Comprehensive in-bot help.
- **Work/Job System:** Engaging work system with 5 job types, 15-minute cooldown, and diverse rewards. Includes a free starter pack for new workers.
- **Resource Economy:** 5 ore types and 4 wood types used for crafting and trading.
- **Tool Crafting:** 4 tool types with 5 levels each, crafted from resources, impacting job rewards.
- **Caretaking House:** 5-level upgrade system for caretaker job, improving rewards.
- **Market System:** Universal marketplace for all item types, supporting listing, buying, and selling with MongoDB persistence.
- **Auction System:** Time-based auction system for all item types with bidding, automatic settlement, and dual UI (form and text command).
- **Work Guide System:** In-bot documentation for all aspects of the work system.
- **Work Image System:** CDN-hosted custom images for each work type.
- **Admin Economy Tools:** Super admin commands for resource, market, auction, and work management.
- **UST (Universal Skin Token) System:** Cosmetics economy where players earn UST through clan wars to purchase character skins and profile pictures from an interactive shop. Includes a rarity system and admin upload commands.
- **Character Info Command:** View character information without owning them.
- **Q&A System:** Comprehensive Q&A system with user submission, admin approval workflow, and MongoDB storage.
- **Custom Game Mode:** Allows servers to create custom-themed games with unique characters and special moves, alongside the standard ZooBot mode. Custom characters require admin approval and are server-specific, while economies remain global.

**System Design Choices:**
- **Modularity & Scalability:** Core functionalities separated, designed for MongoDB.
- **Data Management:** Automatic data backfilling, environment-based configuration, dual-save system, and graceful shutdown.
- **Error Handling:** Comprehensive with user-friendly messages.
- **Performance Optimization:** In-memory caching, MongoDB indexes, and optimized Discord API calls.
- **Security:** Role-based access control for critical commands.
- **Multi-Server Architecture:** Supports deployment across multiple Discord servers with differentiated features.

## External Dependencies
- **Discord.js v14**: Discord API interactions.
- **Node.js 20**: JavaScript runtime environment.
- **Express**: Lightweight HTTP server (for health checks).
- **MongoDB**: Production data persistence.