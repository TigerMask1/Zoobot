# ZooBot Command Documentation

**Last Updated:** December 13, 2025  
**Status:** Migration In Progress

---

## Overview

ZooBot is a character collection and battle Discord bot. This document provides comprehensive documentation of all commands.

---

## Command Categories

### Economy Commands (`!` prefix)

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `balance` | `bal`, `coins`, `money` | Check your balance | `!balance [@user]` |
| `daily` | `d` | Claim daily rewards | `!daily` |
| `work` | `w` | Work to earn resources | `!work` |
| `shop` | - | View the shop | `!shop` |
| `crate` | - | View your crates | `!crate` |
| `opencrate` | `openchest` | Open a crate | `!opencrate <type>` |
| `bulkopen` | `openall` | Open multiple crates | `!bulkopen <type> <amount>` |
| `inventory` | `inv`, `bag` | View inventory | `!inventory` |
| `items` | - | View collectible items | `!items` |
| `buyslot` | - | Buy character slots | `!buyslot` |

### Character Commands

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `start` | - | Create your account | `!start` |
| `collection` | - | View your characters | `!collection [page]` |
| `character` | `char` | View character details | `!char <name>` |
| `release` | `leave` | Release a character | `!release <name>` |
| `catch` | `c`, `grab` | Catch a dropped character | `!c <code>` |
| `levelup` | - | Level up a character | `!levelup <name>` |

### Battle Commands

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `battle` | `b` | Battle another player | `!b @user` |

### Social Commands

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `profile` | - | View your profile | `!profile [@user]` |
| `leaderboard` | `lb` | View leaderboards | `!lb [type]` |
| `clan` | `clanprofile` | View clan info | `!clan [name]` |
| `clans` | `clanleaderboard` | Clan leaderboard | `!clans [page]` |
| `joinclan` | - | Join a clan | `!joinclan <name>` |
| `leaveclan` | - | Leave your clan | `!leaveclan` |
| `donate` | - | Donate to clan | `!donate <amount>` |

### Admin Commands (Requires Admin Role)

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `setup` | - | Server setup wizard | `!setup` |
| `setdropchannel` | - | Set drop channel | `!setdropchannel #channel` |
| `seteventschannel` | - | Set events channel | `!seteventschannel #channel` |
| `settings` | `ss`, `serversettings` | View/edit settings | `!settings [section]` |
| `toggle` | `feature` | Toggle features | `!toggle <feature> [on/off]` |
| `addadmin` | - | Add server admin | `!addadmin @user` |
| `removeadmin` | - | Remove server admin | `!removeadmin @user` |
| `admins` | `viewadmins` | View admins | `!admins` |
| `hierarchy` | `roles` | View role hierarchy | `!hierarchy` |
| `grant` | `give` | Grant currency | `!grant @user <coins/gems> <amount>` |
| `servercharacter` | `sc` | Manage server characters | `!sc <subcommand>` |

### Moderation Commands

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `warn` | - | Warn a user | `!warn @user [reason]` |
| `warnings` | - | View warnings | `!warnings [@user]` |
| `clearwarnings` | - | Clear warnings | `!clearwarnings @user` |
| `botban` | - | Ban from bot | `!botban @user [reason]` |
| `unbotban` | `botunban` | Unban from bot | `!unbotban @user` |
| `mute` | `silence` | Mute user | `!mute @user [duration] [reason]` |
| `unmute` | - | Unmute user | `!unmute @user` |
| `modlogs` | - | View mod logs | `!modlogs` |
| `modhelp` | - | Moderation help | `!modhelp` |

### Utility Commands

| Command | Aliases | Description | Usage |
|---------|---------|-------------|-------|
| `help` | `h`, `commands` | Get help | `!help [command]` |
| `ping` | `latency` | Check latency | `!ping` |

---

## Permission Hierarchy

| Level | Role | Description |
|-------|------|-------------|
| 5 | Super Admin 👑 | Full bot control, economy management |
| 4 | Bot Admin ⚡ | Global moderation, content approval |
| 3 | Server Owner 🏠 | Full server control |
| 2 | Server Admin 🛡️ | Server management |
| 1 | ZooAdmin 🔧 | Basic moderation |
| 0 | Player 🎮 | Regular user |

All permission checks should use `serverConfigManager.js` functions:
- `isSuperAdmin(userId)`
- `isGlobalBotAdmin(userId)`
- `isServerAdmin(userId, serverId, member)`
- `canSetupServer(userId, serverId, member)`
- `canModerate(userId, serverId, member)`
- `canBanInServer(userId, serverId, member)`
- `canMuteInServer(userId, serverId, member)`
- `canToggleFeatures(userId, serverId, member)`

---

## Feature Toggles

Servers can enable/disable features using `!toggle <feature>`:

- `dropsEnabled` - Character drops
- `eventsEnabled` - Special events
- `giveawaysEnabled` - Giveaway system
- `lotteryEnabled` - Lottery system
- `tradingEnabled` - Player trading
- `marketEnabled` - Market listings
- `battlesEnabled` - PvP battles
- `minigamesEnabled` - Minigames
- `triviaEnabled` - Trivia questions
- `clanSystemEnabled` - Clan system
- `leaderboardsEnabled` - Leaderboards
- `workSystemEnabled` - Work commands
- `questsEnabled` - Quest system
- `dailyRewardsEnabled` - Daily rewards

---

## Server Setup Requirements

1. **Characters:** Minimum 5 characters required
2. **Drop Channel:** Set with `!setdropchannel #channel`
3. **Events Channel:** Set with `!seteventschannel #channel`
4. **Updates Channel:** Set with `!ss updates #channel`

---

## Migration Status

### Phase 1: Core Infrastructure (COMPLETE)
- [x] Command handler framework in `/commands/commandHandler.js`
- [x] Permission system in `serverConfigManager.js`
- [x] Configuration centralized in `config.js`

### Phase 2: Command Migration (IN PROGRESS)
- [x] Economy commands: balance, daily, shop, crate, items, buyslot, inventory
- [x] Character commands: start, collection, character, release
- [x] Admin commands: serverCharacter, toggle, settings
- [x] Social commands: profile, leaderboard, clan
- [x] Moderation commands: warn, ban, mute
- [ ] Battle commands (375+ cases in index.js to migrate)
- [ ] Utility commands (giveaway, lottery, market, auction)

### Phase 3: Cleanup (PENDING)
- [ ] Remove legacy switch-case from index.js
- [ ] Standardize all permission checks
- [ ] Complete documentation

---

## Environment Variables

```
DISCORD_BOT_TOKEN        - Discord bot authentication
MONGODB_URI              - MongoDB connection string
USE_MONGODB              - Enable MongoDB mode ('true')
MAIN_SERVER_ID           - Primary server ID
SESSION_SECRET           - Dashboard session secret
DISCORD_CLIENT_ID        - OAuth client ID
DISCORD_CLIENT_SECRET    - OAuth client secret
```

---

## Data Storage

### MongoDB Collections (Primary)
- `serverCharacters` - Server-specific characters
- `serverCollectibles` - Server collectibles
- `serverConfigs` - Server configurations
- `globalCharacters` - Public shared characters
- `globalCollectibles` - Public collectibles

### Key Systems
- `characterManager.js` - Character operations
- `collectibleItemsSystem.js` - Collectible operations
- `serverConfigManager.js` - Server settings & permissions
- `dataManager.js` - User data persistence

---

**End of Documentation**
