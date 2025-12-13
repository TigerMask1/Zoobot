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
| `shop` | NOT FOUND | `commands/economy/shop.js` | MODULAR ONLY |
| `leaderboard` | NOT FOUND | `commands/social/leaderboard.js` | MODULAR ONLY |
| `work` | NOT FOUND | `commands/work/work.js` | MODULAR ONLY |
| `servercharacter/sc` | NOT FOUND | `commands/admin/serverCharacter.js` | MODULAR ONLY |

**Risk:** When both systems are active, the same command could execute twice or produce inconsistent behavior depending on which handler catches it first.

**REQUIRED FIX:**
1. Designate `commandHandler.js` as the SINGLE source of truth
2. Migrate ALL index.js case statements to modular files
3. Remove switch-case block from index.js after migration

---

### 2. CHARACTER DATA FRAGMENTATION (CRITICAL)

**Problem:** Character data is stored in 4+ locations:

| Location | Type | Purpose | Status |
|----------|------|---------|--------|
| `characters.js` | Hardcoded Array | Original 52 ZooBot characters | LEGACY |
| `characterManager.js` CHARACTERS array | In-Memory | Runtime character cache | ACTIVE |
| MongoDB `characters` | Database | Global character storage | ACTIVE |
| MongoDB `serverCharacters` | Database | Server-specific characters | ACTIVE |
| MongoDB `globalCharacters` | Database | Public shared characters | ACTIVE |
| MongoDB `serverAddedCharacters` | Database | References to added public chars | ACTIVE |

**Conflicts Found:**
- `characterManager.listAllCharacters()` returns only in-memory CHARACTERS
- `!sc list` was fetching from wrong source (fixed in this session)
- `backfillMainServerData()` writes to `serverCharacters` but many commands read from in-memory array
- Dashboard reads from different collections than bot commands

**REQUIRED FIX:**
1. Define `serverCharacters` as canonical source for server-scoped characters
2. Define `globalCharacters` as canonical source for public shared characters
3. Deprecate in-memory CHARACTERS array for writes
4. Update all commands to read from MongoDB consistently

---

### 3. COLLECTIBLE DATA FRAGMENTATION (HIGH)

**Problem:** Same fragmentation pattern as characters:

| Collection | Purpose |
|------------|---------|
| `serverCollectibles` | Server-created collectibles |
| `globalCollectibles` | Public shared collectibles |
| `serverAddedCollectibles` | References to added public collectibles |
| `collectibleItems` | Another collectible system? |

**REQUIRED FIX:**
1. Audit all collectible-related code paths
2. Define single source of truth
3. Remove redundant collections

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

### Phase 1: Immediate Fixes (DONE)
- [x] Fix async/await errors in clanSystem
- [x] Fix `!sc list` to read from MongoDB

### Phase 2: Command Consolidation (TODO)
- [ ] Audit all 375 index.js cases
- [ ] Migrate each to modular command file
- [ ] Remove legacy switch-case block
- [ ] Update commandHandler.js with missing commands

### Phase 3: Storage Consolidation (TODO)
- [ ] Define single source of truth for characters
- [ ] Migrate character reads to MongoDB-first
- [ ] Remove redundant in-memory caches
- [ ] Consolidate collectible storage

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
