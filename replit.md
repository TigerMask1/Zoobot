# Discord Character Collection Bot

## Overview
This project is a Discord bot designed to offer a comprehensive character collection experience. It features over 50 unique characters with stats, leveling, and a skin system. The bot integrates a full economy with multiple currencies, a dynamic battle system, interactive elements like crates and random drops, player trading, and competitive daily events. Its primary goal is to enhance community engagement and provide a persistent, engaging virtual world for users.

## User Preferences
The agent should prioritize iterative development, frequently asking for feedback and approval before implementing major changes. Communication should be clear and concise, avoiding jargon where possible. For coding, a preference for modular, readable, and well-documented code is essential. The agent should always provide detailed explanations for proposed changes or new features. Do not make changes to the `dataManager.js` or `mongoManager.js` files without explicit instruction, as these are critical for data integrity across environments.

## System Architecture
The bot is built on Discord.js v14 and Node.js 20, utilizing a dual-mode data storage system (JSON for testing, MongoDB for production) with a one-command migration script.

**UI/UX Decisions:**
- **Visuals:** Character skins displayed in embeds, paginated user profiles with progress bars, custom profile picture selection from owned characters, and custom PFP image system.
- **Progress Bars:** 12-slot colored emoji progress bars (🟩🟦🟨🟧🟥⬜) with percentage display for token collection.
- **Information Display:** Extensive use of Discord embeds and emoji integration for characters and items.

**Technical Implementations:**
- **Character System:** 50+ unique characters with tokens, special traits, moves, HP scaling, levels, and owned skins.
- **Economy & Currency:** Coins, Gems, Trophies, and Character-specific Tokens, with daily login and message-based rewards.
- **Crate System:** Multi-tiered crates (Gold, Emerald, Legendary, Tyrant, Bronze, Silver) offering characters, tokens, and coins, including a "pending tokens" system and interactive opening with customizable GIFs.
- **Drop System:** Random token, coin, and gem drops every 20 seconds, claimable by the first user, optimized to reduce API calls by leaving uncaught drops in chat. Includes a paid drop system for non-main servers and smart pausing.
- **Trading System:** Secure player-to-player trading with dual confirmation.
- **Battle System:** Turn-based combat with energy management, 51 unique passive abilities, critical hits, status effects, and consumable items. Includes an AI battle system.
- **Inventory:** MongoDB-compatible inventory for battle items.
- **Event System:** Daily rotating competitive events (Trophy Hunt, Crate Master, Drop Catcher) with real-time tracking, automatic reward distribution, and manual/scheduled control. Event announcements broadcast to all servers (main server uses fixed channel, other servers use configured events channel).
- **Giveaway System:** Daily giveaways with automatic prize distribution. Broadcasts to specific giveaway channel in main server and events channels in other servers.
- **Lottery System:** Universal lottery system with ticket purchases using gems. Prize pool accumulates and broadcasts results to all servers via updates channels.
- **Promotion System:** Automated promotional messages for non-main servers, posted to updates channels every 4 hours.
- **Permission System:** Three-tier role-based access control:
  - **Super Admin:** Hardcoded bot owners with full access to all commands globally
  - **ZooAdmin Role:** Discord role (case insensitive) for server customization - allows server admins to configure channels, activate drops, customize emojis/GIFs
  - **Bot Admin (Legacy):** Database-stored admins for event management (being phased out)
- **Admin Tools:** Commands for managing resources, characters, skins, custom emojis, chest GIFs, and bot channels, along with server management and bot update broadcasting.
- **Key & Cage System:** Two-tier character unlock system using character-specific keys and random cage keys obtained from events.
- **Custom Emojis:** System for bot-wide custom character emojis, stored in MongoDB and applied automatically. Centralized emoji configuration in emojiConfig.js for easy customization.
- **Profile Picture (PFP) System:** Custom profile image system allowing users to upload and manage multiple profile pictures stored via Discord CDN URLs. Users can switch between character images and custom PFPs for their profile display using !setpfp command. Supports both character selection (!setpfp <character>) and custom PFP selection (!setpfp pfp <number>).
- **Personalized Task System:** Task system restricted to registered players who have completed !start command.
- **Trivia System:** Interactive trivia with 3-guess limit, 1-minute timer, 30-second cooldown, and 100 coin rewards. Bot admin-manageable question database.
- **AI Battle Scaling:** Dynamic AI difficulty scaling for hard mode that adjusts level (1.2× + 3-5 bonus) and ST (minimum 90, up to 115 cap) based on challenger stats, with interpolated scaling for low-ST players and HP multipliers for high-ST players to maintain competitive balance.
- **Mail System:** Inbox clearing functionality for users.
- **Help Documentation:** Comprehensive in-bot help and command reference.
- **Work/Job System (UPDATED):** Engaging work system with 5 job types (Miner, Caretaker, Farmer, Zookeeper, Ranger) on 15-minute cooldown. Jobs reward coins, gems, ores, wood, tokens, crates, keys, and shards. First work is always caretaker to bootstrap new players. **FREE STARTER PACK:** All new workers receive level 1 drill, axe, whistle, binoculars, and caretaker house automatically - no grinding required to start!
- **Resource Economy:** 5 ore types (🟡 Aurelite, 🔵 Kryonite, 🟣 Zyronite, 🔴 Rubinite, ⚫ Voidinite) and 4 wood types (🟤 Oak, 🟠 Maple, ⚫ Ebony, ✨ Celestial) used for crafting and trading.
- **Tool Crafting:** 4 tool types (⛏️ Drill, 🪓 Axe, 📢 Whistle, 🔭 Binoculars) with 5 levels each. Tools have durability and are crafted from ores and wood. Higher level tools = better job rewards. Legacy users automatically receive missing starter tools.
- **Caretaking House:** 5-level upgrade system for caretaker job, requiring coins, gems, and resources. Higher levels provide better rewards when working. Starts at level 1 for free.
- **Market System (UPDATED):** Universal marketplace supporting all item types (ores, wood, crates, keys, resources). Players can list, buy, and sell items for coins with MongoDB persistence. Uses clean sequential IDs (M001, M002, M003, etc.) for easy reference.
- **Auction System (UPDATED):** Time-based auction system supporting all item types with bidding mechanics, automatic settlement, and instant MongoDB saves. Uses clean sequential IDs (A001, A002, A003, etc.) for easy reference. **DUAL UI (Nov 27):** Multi-step form with category dropdown → item dropdown → modal with 4 fields (Quantity, Starting Bid, Duration, Currency). Form defaults to coins & 24 hours. Classic text command also available: `!auction create <category> <item> <qty> <bid> [hours] [currency]`. Both support gems currency.
- **Work Guide System (NEW):** Comprehensive in-bot documentation via !workguide command explaining all jobs, tools, rewards, crafting, market, and strategy tips. Makes the work system accessible to all players.
- **Work Image System (NEW):** CDN-hosted custom images for each work type (drill, room, axe, whistle, binoculars). Admins can customize with !setworkimage, users can view with !showwork.
- **Admin Economy Tools (UPDATED):** Super admin commands for resource management (!giveores, !givewood, !givetool), market control (!clearmarket, !viewmarket), auction management (!clearauctions, !viewauctions, !endauction), work assignment (!assignwork), and work image customization (!setworkimage).
- **UST (Universal Skin Token) System (NEW):** Complete cosmetics economy system where players earn UST through clan wars and spend it on character skins and profile pictures. Features:
  - **UST Currency:** Earned by top 3 clans in weekly clan wars, distributed proportionally based on contribution
  - **UST Shop (!ustshop):** Interactive shop with category selection (skins/pfps), shows only skins for characters the user owns, displays rarity and cost
  - **Cosmetics Catalog:** Dual-persistence system (MongoDB for production, JSON file for development) with 5-minute cache TTL for performance
  - **Rarity System:** 5 rarity tiers (Common: 10 UST, Rare: 25 UST, Ultra Rare: 50 UST, Epic: 100 UST, Legendary: 200 UST) with custom cost override
  - **Upload Commands:** !uploadskin and !uploadpfp for super admins to add new cosmetics - supports both image attachments AND direct image links for flexibility
  - **Purchase System:** Integrated with existing cosmetics system, purchased items immediately available in !setpfp and !setskin

**System Design Choices:**
- **Modularity & Scalability:** Core functionalities are separated into dedicated files, designed with MongoDB integration for production.
- **Data Management:** Automatic data backfilling, environment-based configuration, and a dual-save system (`saveDataImmediate()` for critical operations, batched saves for telemetry) with graceful shutdown handlers.
- **Error Handling:** Comprehensive error handling with user-friendly messages.
- **Performance Optimization:** In-memory caching for skins, MongoDB indexes for fast queries, and optimized drop system to minimize Discord API calls.
- **Security:** Critical economy/admin commands restricted to super-admins. Server customization requires ZooAdmin role for safe delegation of bot management to trusted server members.
- **Multi-Server Architecture:** Supports deployment across multiple Discord servers, differentiating features like drop rates, clan wars, and promotional messages between a "Main Server" and "Non-Main Servers."

- **Character Info Command (!info):** View any character's information without owning them - see default skin, special ability, and how to obtain them.
- **Dynamic Character System (Nov 30 Fix):** Dynamically created characters now automatically receive:
  - Default special move (`<Name>'s Strike`, 90 damage) if none specified
  - Default passive ability (`<Name>'s Power`, +5 flat damage) if none specified
  - Full battle data (moves, HP) when granted to users
- **Force Release Command (!forcerelease):** Super admin command to release any character regardless of level. Usage: `!forcerelease <character>` or `!forcerelease @user <character>`.
- **Q&A System (UPDATED):** Comprehensive Q&A system with user submissions for approval:
  - **User Commands:** `!q` (list topics), `!q <keyword>` (get answer), `!submitqa keyword | question | answer` (submit for approval)
  - **Admin Commands:** `!qadd keyword | message` (add directly), `!qedit keyword | message` (edit), `!qdel keyword` (delete), `!pendingqa` (view pending), `!approveqa <id>` (approve), `!rejectqa <id> <reason>` (reject)
  - **Submission Workflow:** Users submit Q&A → Pending review → Admin approves/rejects → User gets 10 gems + DM notification on approval
  - **Storage:** All entries stored in MongoDB for persistence

## External Dependencies
- **Discord.js v14**: For all Discord API interactions.
- **Node.js 20**: The JavaScript runtime environment.
- **Express**: Used for a lightweight HTTP server, primarily for health checks.
- **MongoDB**: Utilized for production data persistence and scalability.