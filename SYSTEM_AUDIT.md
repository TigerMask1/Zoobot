# ZooBot System Audit Report

**Audit Date:** December 13, 2025  
**Auditor:** Replit Agent  
**Status:** CRITICAL ISSUES FOUND

---

## Executive Summary

ZooBot has been developed by multiple independent agents, resulting in significant architectural fragmentation. This audit identifies **375 command cases in index.js** alongside **28 modular command files** in `/commands`, creating a dual command system with conflicts. Character and collectible data is stored across **6+ MongoDB collections** with overlapping purposes. Multiple systems read from inconsistent data sources.

---

## CRITICAL ISSUES

### 1. DUAL COMMAND SYSTEM (CRITICAL)

**Problem:** Commands are defined in TWO places that both execute:
- `index.js`: 375+ switch-case command handlers (legacy monolithic)
- `/commands/**/*.js`: 28 modular command files via `commandHandler.js`

**Duplicate Commands Found:**
| Command | index.js Line | commands/ File | Conflict Type |
|---------|---------------|----------------|---------------|
| `profile` | 2613 | `commands/social/profile.js` | DUPLICATE |
| `battle` | 4698 | `commands/battle/battle.js` | DUPLICATE |
| `leaderboard` | 5297 | `commands/social/leaderboard.js` | DUPLICATE |
| `work` | 7216 | `commands/work/work.js` | DUPLICATE |
| `daily` | 5341 | `commands/economy/daily.js` | DUPLICATE |
| `crate` | 3182 | `commands/economy/crate.js` | DUPLICATE |
| `shop` | NOT FOUND | `commands/economy/shop.js` | MODULAR ONLY |
| `servercharacter/sc` | NOT FOUND | `commands/admin/serverCharacter.js` | MODULAR ONLY |

**Note:** 375 total case statements in index.js with 28 modular command files. Most core commands exist in BOTH locations.

**Risk:** When both systems are active, the same command could execute twice or produce inconsistent behavior depending on which handler catches it first.

**REQUIRED FIX:**
1. Designate `commandHandler.js` as the SINGLE source of truth
2. Migrate ALL index.js case statements to modular files
3. Remove switch-case block from index.js after migration

---

### 2. CHARACTER DATA FRAGMENTATION (ADDRESSED)

**Problem:** Character data is stored in 4+ locations:

| Location | Type | Purpose | Status |
|----------|------|---------|--------|
| `characters.js` | Hardcoded Array | Original 52 ZooBot characters | LEGACY (read-only reference) |
| `characterManager.js` CHARACTERS array | In-Memory | Cache of base characters from MongoDB | CACHE ONLY |
| MongoDB `characters` | Database | Base ZooBot character definitions | PRIMARY for base chars |
| MongoDB `serverCharacters` | Database | Server-specific custom characters | PRIMARY for server chars |
| MongoDB `globalCharacters` | Database | Public shared characters | PRIMARY for public chars |
| MongoDB `serverAddedCharacters` | Database | References linking servers to public chars | REFERENCE ONLY |

**Architecture Clarification (December 13, 2025):**
- The in-memory `CHARACTERS` array is a **cache** of base ZooBot characters, loaded from MongoDB `characters` collection on startup
- Server-specific characters are stored in MongoDB `serverCharacters` collection (not in the in-memory array)
- When getting characters for a server, you must query BOTH sources

**NEW Functions Added to characterManager.js:**
```javascript
// PRIMARY: Get combined base + server-specific characters for a server
await characterManager.getCombinedCharactersForServer(serverId, { gameName, obtainable })

// PRIMARY: Look up character by name, checking both in-memory AND MongoDB
await characterManager.getCharacterByNameWithServer(name, serverId)

// Existing MongoDB functions for server-specific operations:
await characterManager.getServerSpecificCharactersFromDB(serverId)
await characterManager.getServerCharacterByName(serverId, name)
await characterManager.getCrateServerCharacters(serverId, crateType)
await characterManager.getDroppableServerCharacters(serverId)
```

**CANONICAL USAGE:**
| Use Case | Function to Use |
|----------|-----------------|
| Get ALL characters for a server | `getCombinedCharactersForServer(serverId)` |
| Look up character by name | `getCharacterByNameWithServer(name, serverId)` |
| Get base ZooBot chars only | `getCharacters()` (in-memory cache, fast) |
| Get server-specific chars only | `getServerSpecificCharactersFromDB(serverId)` |
| Crate drops | `getCrateServerCharacters(serverId)` + `getCharacters()` |

**Status:** ARCHITECTURE DOCUMENTED - Functions added. Key files already use proper patterns.

---

### 3. COLLECTIBLE DATA FRAGMENTATION (ADDRESSED)

**Problem:** Collectible data is stored in 4+ locations:

| Collection | Type | Purpose | Status |
|------------|------|---------|--------|
| `collectibleItems` | Database | Main ZooBot system collectibles (bundles, availability windows) | PRIMARY for system items |
| `serverCollectibles` | Database | Server-created custom collectibles | PRIMARY for server customs |
| `globalCollectibles` | Database | Public shared collectibles that servers can add | PRIMARY for public sharing |
| `serverAddedCollectibles` | Database | References linking servers to added public collectibles | REFERENCE ONLY |
| `userCollectibleItems` | Database | User inventory of collectible items | USER DATA |

**Architecture Clarification (December 13, 2025):**
- `collectibleItemsSystem.js` is the **CENTRAL HUB** for ALL collectible operations
- It handles BOTH system collectibles (`collectibleItems`) AND server-specific (`serverCollectibles`)
- Server-created collectibles use `serverCollectibles` collection
- Global/public collectibles use `globalCollectibles` collection
- Servers can add public collectibles via `serverAddedCollectibles` references

**Key Functions in `collectibleItemsSystem.js`:**
```javascript
// SYSTEM COLLECTIBLE ITEMS (collectibleItems collection)
await createCollectibleItem(itemData)
await getCollectibleItem(itemId)
await getDroppableCollectibleItems(bundle)
await getCrateCollectibleItems(bundle, crateType, serverId)
await awardCollectibleItem(userId, itemId, quantity)

// SERVER-SPECIFIC COLLECTIBLES (serverCollectibles collection)
await getServerSpecificCollectiblesFromDB(serverId)
await getServerCollectibleByName(serverId, name)
await getDroppableServerCollectibles(serverId)
await getCrateServerCollectibles(serverId, crateType)
await awardServerCollectible(userId, serverId, collectibleId, quantity)

// USER COLLECTIBLES
await getUserCollectibleItems(userId, page)
await getAllUserCollectibleItems(userId)
```

**CANONICAL USAGE:**
| Use Case | Function to Use |
|----------|-----------------|
| Get system collectibles for crates | `getCrateCollectibleItems(bundle, crateType)` |
| Get server collectibles for crates | `getCrateServerCollectibles(serverId, crateType)` |
| Get droppable system items | `getDroppableCollectibleItems(bundle)` |
| Get droppable server items | `getDroppableServerCollectibles(serverId)` |
| Award system collectible | `awardCollectibleItem(userId, itemId, quantity)` |
| Award server collectible | `awardServerCollectible(userId, serverId, collectibleId, quantity)` |
| Get user's collectible inventory | `getUserCollectibleItems(userId, page)` |

**Status:** ARCHITECTURE DOCUMENTED - `collectibleItemsSystem.js` is the central hub. No code changes needed.

---

### 4. ASYNC/AWAIT ERRORS (FIXED)

**Problem:** Async functions called without `await`:
- `formatClanLeaderboard()` - FIXED in index.js:2497
- `formatClanProfile()` - FIXED in index.js:2490

**Status:** RESOLVED in this session

---

### 5. CONFIGURATION REDUNDANCY (MEDIUM)

**Problem:** MAIN_SERVER_ID defined in multiple files:

| File | Line | Value |
|------|------|-------|
| `config.js` | 4 | `process.env.MAIN_SERVER_ID \|\| '1430516117851340893'` |
| `characterKeySystem.js` | 15 | `'1430516117851340893'` |
| `dropSystem.js` | 16 | `'1430516117851340893'` |
| `serverConfigManager.js` | 3 | `'1430516117851340893'` |

**REQUIRED FIX:**
1. Use ONLY `config.js` exports for configuration
2. Import `BOT_CONFIG.MAIN_SERVER_ID` everywhere
3. Remove hardcoded duplicates

---

### 6. PERMISSION SYSTEM FRAGMENTATION (MEDIUM)

**Problem:** Permission checks implemented differently:

| System | Location | Method |
|--------|----------|--------|
| Super Admin | `serverConfigManager.js` | `isSuperAdmin()` |
| Bot Admin | `serverConfigManager.js` | `isBotAdmin()` |
| Server Admin | `serverConfigManager.js` | `isServerAdmin()` |
| Server Owner | `serverConfigManager.js` | `isServerOwner()` |
| Can Setup | `serverConfigManager.js` | `canSetupServer()` |

**Note:** Some commands in index.js manually check `SUPER_ADMINS` array while modular commands use `adminOnly` flag.

**REQUIRED FIX:**
1. Standardize all permission checks through `serverConfigManager.js`
2. Remove inline SUPER_ADMINS checks

---

### 7. NON-FUNCTIONAL/PLACEHOLDER CODE (LOW)

**Potentially Non-Functional:**
- `qaSubmissionSystem.js` - Check if QA queue has active submissions
- `questSystem.js` - Verify quests are being assigned and tracked
- `minigamesSystem.js` - Check if minigames execute
- `toolSystem.js` - Verify tool crafting works
- `resourceSystem.js` - Check resource collection

**REQUIRED FIX:**
1. Audit each system for functional completeness
2. Remove or complete stub implementations

---

## STORAGE SCHEMA (CANONICAL REFERENCE)

### MongoDB Collections (Authoritative)

```
characters              - Global character definitions (legacy)
serverCharacters        - Server-specific characters (PRIMARY for servers)
globalCharacters        - Public shared characters (PRIMARY for public)
serverAddedCharacters   - References linking servers to public chars

serverCollectibles      - Server-specific collectibles
globalCollectibles      - Public shared collectibles
serverAddedCollectibles - References linking servers to public collectibles

serverConfigs           - Server settings and configurations
serverAura              - Server aura tracking for clan wars
christmasEvent          - Seasonal event data
characterSubmissions    - Pending character submissions
crate_visuals           - Custom crate/chest visuals
```

### Data Files (Legacy/Backup)

```
data.json               - User data (should migrate to MongoDB)
characters.js           - Hardcoded original characters (read-only reference)
characterAbilities.js   - Ability definitions
moves.js                - Special move definitions
skins.json              - Skin definitions
```

---

## COMMAND HIERARCHY (CANONICAL REFERENCE)

### Execution Priority
1. `/commands/**/*.js` via `commandHandler.js` (PRIMARY)
2. `index.js` switch-case (LEGACY - TO BE DEPRECATED)

### Command Categories
- `admin/` - Server and bot administration
- `battle/` - Combat system
- `characters/` - Character management
- `economy/` - Currency and shops
- `events/` - Seasonal events
- `moderation/` - User moderation
- `social/` - Profiles and leaderboards
- `work/` - Resource gathering

---

## REQUIRED ACTIONS

### Phase 1: Immediate Fixes (DONE - December 13, 2025)
- [x] Fix async/await errors in index.js (lines 2490, 2497) for formatClanProfile/formatClanLeaderboard
- [x] Fix `!sc list` to read from MongoDB serverCharacters collection (removed in-memory fallback)
- [x] Fix `!sc view` to read from MongoDB serverCharacters and globalCharacters collections (removed in-memory fallback)
- [x] Add serverId parameter to formatClanProfile call for proper server aura display

### Phase 2: Command Consolidation (TODO)
- [ ] Audit all 375 index.js cases
- [ ] Migrate each to modular command file
- [ ] Remove legacy switch-case block
- [ ] Update commandHandler.js with missing commands

### Phase 3: Storage Consolidation (DONE - December 13, 2025)
- [x] Define single source of truth for characters (documented in section 2)
- [x] Added `getCombinedCharactersForServer()` and `getCharacterByNameWithServer()` functions
- [x] Architecture documented - in-memory cache is for base chars, MongoDB for server-specific
- [x] Collectible storage documented (section 3) - `collectibleItemsSystem.js` is the central hub

### Phase 4: Configuration Cleanup (TODO)
- [ ] Centralize all config in config.js
- [ ] Remove hardcoded constants from other files
- [ ] Standardize environment variable usage

### Phase 5: Permission Standardization (TODO)
- [ ] Route all permission checks through serverConfigManager
- [ ] Remove inline admin checks from commands
- [ ] Document permission hierarchy

---

## RULES FOR FUTURE AGENTS

1. **NEVER add commands to index.js switch-case** - Use `/commands/` directory only
2. **NEVER duplicate configuration values** - Import from `config.js`
3. **ALWAYS use MongoDB for persistent storage** - No new JSON files
4. **ALWAYS await async functions** - Especially those returning embeds
5. **USE serverConfigManager for permissions** - No custom permission checks
6. **ONE source of truth per data type** - Document which collection is canonical
7. **TEST commands in isolation** - Before integration
8. **UPDATE this audit** - When adding new systems

---

## FILES REQUIRING REFACTORING

| Priority | File | Issue |
|----------|------|-------|
| CRITICAL | `index.js` | 375 case statements need migration |
| HIGH | `characterManager.js` | In-memory vs MongoDB inconsistency |
| HIGH | `commands/admin/serverCharacter.js` | Fixed - now reads from MongoDB |
| MEDIUM | `characterKeySystem.js` | Hardcoded MAIN_SERVER_ID |
| MEDIUM | `dropSystem.js` | Hardcoded MAIN_SERVER_ID |
| MEDIUM | `serverConfigManager.js` | Hardcoded MAIN_SERVER_ID |
| LOW | `clanSystem.js` | Fixed async/await issues |

---

## APPENDIX: Quick Reference

### Environment Variables Required
```
DISCORD_BOT_TOKEN        - Discord bot authentication
MONGODB_URI              - MongoDB connection string
USE_MONGODB              - Enable MongoDB mode ('true')
MAIN_SERVER_ID           - Primary server ID
SESSION_SECRET           - Dashboard session secret
DISCORD_CLIENT_ID        - OAuth client ID
DISCORD_CLIENT_SECRET    - OAuth client secret
```

### Key Functions
```javascript
// Permission checks
isSuperAdmin(userId)
isBotAdmin(userId, serverId)
isServerAdmin(userId, serverId)
canSetupServer(userId, serverId, member)

// Character operations
characterManager.getCharacterByName(name)
characterManager.listAllCharacters()  // DEPRECATED - use MongoDB
getCollection('serverCharacters')     // PRIMARY for server chars

// Configuration
BOT_CONFIG.MAIN_SERVER_ID            // PRIMARY config source
```

---

**End of Audit Report**
