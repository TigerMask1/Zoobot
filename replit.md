# Discord Character Collection Bot

## Overview
This project is a Discord bot offering a comprehensive character collection experience with over 50 unique characters, stats, leveling, and a skin system. It features custom game modes where servers can create completely isolated themed games with custom characters maintaining full feature parity. All systems support both ZooBot (default 51 characters) and Custom game modes with mandatory setup workflow.

## Recent Changes (v2.0 - Game Mode Isolation)

### Mandatory Setup Flow
- **No Default Game Mode**: Servers MUST explicitly choose between ZooBot or Custom mode via `!setup`
- **Command Gating**: All non-setup commands are blocked until game mode is selected
- **Game Mode Prompt**: Clear interactive guide showing differences between modes
- **Setup Status Tracking**: Server-wide config stores game mode selection with timestamp

### Game Mode Isolation
- **Character Catalog API**: Unified `getCharactersForServer()` routes all character lookups through game-aware system
- **Complete Isolation**: When Custom mode active, ONLY custom characters appear - zero ZooBot interference
- **All Systems Updated**: Crates, drops, keys, cages, events all respect game mode isolation
- **Fallback Prevention**: Removed hardcoded CHARACTERS references - all systems use catalog API

### Custom Character Feature Parity
Extended custom character schema includes:
- **Tokens & Skins**: Full token config and skin unlock systems
- **Traits System**: Primary, secondary, and hidden traits support
- **ST Boosts**: Custom multipliers for stat scaling
- **Level Caps**: Configurable max level and XP curve settings
- **Battle Compatibility**: Full integration with battle utils and combat system
- **Skill Trees**: Support for unique move damage and scaling

### Export/Import System
- **Portable Games**: `!exportgame` creates base64 export code with all approved characters
- **Load Anywhere**: `!loadgame <code>` imports complete custom game to any server (with custom mode active)
- **Full Preservation**: Starters, character stats, traits, and all metadata preserved
- **Cloning Support**: Games can be cloned across servers by exporting and importing

### Caching & Optimization
- **Character Cache**: 60-second TTL cache for character lookups (massive performance gain)
- **Server-Specific Cache Keys**: Cache invalidation on character changes
- **Reduced DB Calls**: Eliminated redundant character queries in crates, drops, events
- **Battle Utils Optimization**: Custom character move assignment without unnecessary lookups

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, utilizing a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script.

**UI/UX Decisions:**
- **Visuals:** Character skins displayed in embeds, paginated user profiles with progress bars, custom profile picture selection, and custom PFP image system.
- **Progress Bars:** 12-slot colored emoji progress bars with percentage display.
- **Information Display:** Extensive use of Discord embeds and emoji integration.

**Technical Implementations:**
- **Character System:** 50+ unique characters (ZooBot) + unlimited custom characters per server with tokens, traits, moves, HP scaling, levels, and owned skins.
- **Economy & Currency:** Multiple currencies (Coins, Gems, Trophies, Character Tokens) with daily login and message-based rewards.
- **Crate System:** Multi-tiered crates offering characters, tokens, and coins, including a "pending tokens" system. Fully game-mode aware.
- **Drop System:** Random token, coin, and gem drops with optimization for reduced API calls. Server-specific character pools.
- **Trading System:** Secure player-to-player trading with dual confirmation.
- **Battle System:** Turn-based combat with energy management, passive abilities, critical hits, status effects, consumable items, and AI battles. AI difficulty scales dynamically. Compatible with both ZooBot and custom characters.
- **Inventory:** MongoDB-compatible inventory for battle items.
- **Event System:** Daily rotating competitive events with real-time tracking and automatic reward distribution. Uses game-aware character catalog.
- **Giveaway & Lottery Systems:** Automated prize distribution and universal lottery with prize pools.
- **Promotion System:** Automated promotional messages for non-main servers.
- **Permission System:** Three-tier role-based access control (Super Admin, ZooAdmin Role, Bot Admin).
- **Admin Tools:** Commands for managing game resources, characters, skins, and bot configuration.
- **Key & Cage System:** Two-tier character unlock system with game-aware character resolution.
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
- **Custom Game Mode:** Allows servers to create completely isolated custom-themed games with unique characters and full feature parity. Custom characters require admin approval. Game modes are mandatory - no defaults allowed.

**System Design Choices:**
- **Modularity & Scalability:** Core functionalities separated, designed for MongoDB with game-mode awareness.
- **Data Management:** Automatic data backfilling, environment-based configuration, dual-save system, and graceful shutdown.
- **Error Handling:** Comprehensive with user-friendly messages.
- **Performance Optimization:** In-memory caching (60s TTL), MongoDB indexes, optimized Discord API calls, character catalog caching.
- **Security:** Role-based access control for critical commands.
- **Multi-Server Architecture:** Supports deployment across multiple Discord servers with complete game mode isolation.
- **Game Isolation:** Character lookups, item drops, crates, and all gameplay systems respect active game mode - zero cross-contamination.

## New Commands (v2.0)
- `!setup` - Interactive server setup with mandatory game mode selection
- `!setgamemode <zoobot|custom>` - Set server game mode (permanent per server)
- `!gameinfo` - View current server game mode and custom game details
- `!exportgame` - Export custom game with all approved characters as portable code
- `!loadgame <export_code>` - Import exported game from another server
- `!listgames` - Super admin command to list all active custom games

## External Dependencies
- **Discord.js v14**: Discord API interactions.
- **Node.js 20**: JavaScript runtime environment.
- **Express**: Lightweight HTTP server (for health checks).
- **MongoDB**: Production data persistence.
