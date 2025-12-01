# Discord Character Collection Bot

## Overview
This project is a Discord bot focused on character collection, featuring over 50 unique characters with stats, leveling, and a skin system. It includes a comprehensive economy with multiple currencies, a dynamic battle system, interactive elements like crates and random drops, player trading, and competitive daily events. The bot aims to boost community engagement and offer a persistent, captivating virtual world for users. It also incorporates multi-game support, allowing servers to select specific character bundles, and robust anti-cheat and moderation systems for a fair and safe environment.

## Website & Server Management Dashboard (December 2025)
The project includes a professional website and Discord OAuth-based server management dashboard:

**Public Pages (public/ folder):**
- `/` or `/index.html` - Landing page with features overview
- `/features.html` - Detailed feature breakdown
- `/guide.html` - Complete player guide with commands
- `/changelog.html` - Version history and updates
- `/about.html` - About ZooBot and team info

**Server Management Dashboard:**
- `/login.html` - Discord OAuth login page
- `/dashboard.html` - Server management panel (protected)
- Any Discord user with ADMINISTRATOR permission can manage their servers
- Real-time permission verification on each request

**Dashboard Features:**
- View all servers where user has admin permissions
- Toggle features per server: Drops, Events, Trading, Battles, Crates, Marketplace
- Select active game/character bundle
- View server setup status
- Beautiful responsive UI with dark theme

**Security Features:**
- Discord OAuth2 with state parameter (CSRF protection)
- Real-time permission verification on protected endpoints
- Rate limiting (30 auth requests per 15 min, 100 API requests per min)
- JWT tokens with 7-day expiry stored in HttpOnly cookies
- Helmet.js security headers with CSP
- Secure cookies in production

**API Endpoints:**
- `GET /api/auth/discord` - Initiate Discord OAuth
- `GET /api/auth/discord/callback` - OAuth callback handler
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info
- `GET /api/servers` - List user's admin servers
- `GET /api/servers/:id/settings` - Get server settings
- `PUT /api/servers/:id/settings` - Update server settings
- `GET /api/stats` - Bot statistics
- `GET /api/changelog` - Changelog entries
- `GET /health` - Health check

**Environment Variables for Dashboard:**
- `DISCORD_CLIENT_ID` - **REQUIRED** Discord application client ID
- `DISCORD_CLIENT_SECRET` - **REQUIRED** Discord application client secret
- `DISCORD_REDIRECT_URI` - OAuth callback URL (auto-detected if not set)
- `JWT_SECRET` - Secret for JWT signing (auto-generated if not set)
- `WEBSITE_URL` - Base URL for the website (auto-detected from Render/Replit)

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