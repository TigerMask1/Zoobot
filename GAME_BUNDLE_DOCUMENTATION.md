# Game/Bundle System & Character Submission Documentation
## Latest Update (November 30, 2025)

---

## Table of Contents
1. [Overview](#overview)
2. [Game/Bundle System](#gamebundle-system)
3. [Character Submission System](#character-submission-system)
4. [Server Setup Flow](#server-setup-flow)
5. [Admin Commands](#admin-commands)
6. [User Commands](#user-commands)
7. [Examples & Workflows](#examples--workflows)

---

## Overview

The latest update introduces two major systems to ZooBot:

### **Game/Bundle System**
Allows servers to run different character collections. Instead of all servers sharing one pool of characters, each server can now select which "game" or "bundle" of characters they want to use. Super admins can create custom games, manage character assignments, and import characters between bundles.

### **Character Submission System**
Enables players to submit their own custom characters for bot admin approval. Approved characters are automatically added to the selected game bundle, with full creator attribution. Players receive notifications when their submissions are approved or rejected.

---

## Game/Bundle System

### Overview
- **Main Concept:** Each server selects one game/bundle during setup
- **Character Filtering:** Only characters from the selected game appear in drops and crates
- **Default Game:** "ZooBot" contains the original characters
- **Storage:** All games stored in MongoDB with metadata (created date, creator, status, character count)

---

### User Commands

#### **`!games`** (Everyone)
Lists all available games/bundles.

**Response Example:**
```
🎮 Available Games/Bundles
🟢 ZooBot ✅ (52 chars)
🟢 MyZoo ✅ (28 chars)
🟢 RareCharacters ✅ (15 chars)
🔴 DisabledGame ⚠️ (0 chars)

Use !setgame <name> to select a game for your server
```

---

#### **`!gameinfo [game_name]`**
View detailed information about a game/bundle.

**Usage:**
- `!gameinfo ZooBot` - Show info for ZooBot
- `!gameinfo` - Show info for currently selected game (if in a configured server)

**Response Example:**
```
🎮 ZooBot
The default ZooBot game with all original characters

Status: 🟢 Active
Total Characters: 52
Default: Yes
Characters by Type: crate: 32, drop: 20
Created By: ZooBot
Created: 11/30/2025
```

---

#### **`!bundlechars [game_name]`** | **`!gamechars`**
List all characters in a specific game/bundle.

**Usage:**
- `!bundlechars ZooBot` - List ZooBot characters
- `!gamechars MyZoo` - List MyZoo characters

**Response Example:**
```
📦 Characters in ZooBot

🌙 Luna (crate)
⭐ Max (drop)
🦁 Leo (crate)
🌊 Splash (drop)
... and 48 more
Total: 52 characters
```

---

#### **`!setupstatus`** | **`!serverstatus`**
Check your server's setup progress.

**Usage:**
- `!setupstatus` (must be used in a server)

**Response Example:**
```
📊 Server Setup Status

🎮 Selected Game: MyZoo
📣 Drop Channel: ✅ Set
🎉 Events Channel: ✅ Set
📢 Updates Channel: ✅ Set

Overall Status: ✅ Fully Setup
Use !setupstatus to check your progress
```

---

### Admin Commands (ZooAdmin Role)

#### **`!setgame <game_name>`** | **`!selectgame`**
Select which game/bundle your server uses.

**Requirements:**
- Must be run in a non-main server
- Requires ZooAdmin role or Super Admin
- Game must exist and be active
- Game must have at least 1 character

**Usage:**
- `!setgame ZooBot` - Switch to ZooBot
- `!setgame MyZoo` - Switch to MyZoo

**Response Example:**
```
✅ Server is now using game/bundle: MyZoo

This is a custom game with 28 characters

🎮 Only characters from this game will appear in drops and crates!
```

---

#### **`!creategame <name> [description]`** | **`!createbundle`**
Create a new game/bundle.

**Requirements:**
- ZooAdmin role or Super Admin
- Minimum 2 characters for game name

**Usage:**
- `!creategame MyZoo` - Create "MyZoo" with auto description
- `!creategame MyZoo A custom collection of rare characters` - Create with custom description

**Response Example:**
```
✅ Game/Bundle MyZoo created successfully!

⚠️ Note: This bundle needs at least 1 character before it can be used by servers.
```

---

### Super Admin Commands

#### **`!gamestats`**
View statistics about all games/bundles.

**Requirements:**
- Super Admin only

**Usage:**
- `!gamestats`

**Response Example:**
```
📊 Game Statistics

ZooBot: 52 chars
  └ crate: 32, drop: 20
MyZoo: 28 chars
  └ crate: 15, drop: 13
RareCharacters: 15 chars
  └ crate: 10, drop: 5

Total games: 3
```

---

#### **`!deletegame <name>`** | **`!deletebundle`**
Delete a game/bundle (cannot delete default game).

**Requirements:**
- Super Admin only
- Cannot delete the default "ZooBot" game

**Usage:**
- `!deletegame MyZoo` - Delete MyZoo bundle

**Response Example:**
```
✅ Game/Bundle MyZoo has been deleted!
```

---

#### **`!togglegame <name>`**
Activate or deactivate a game/bundle.

**Requirements:**
- Super Admin only

**Usage:**
- `!togglegame MyZoo` - Toggle MyZoo on/off

**Response Example:**
```
✅ Game MyZoo is now 🟢 Active!
```

---

#### **`!assigngame <character> <game_name>`** | **`!assignbundle`**
Assign a character to a specific game/bundle.

**Requirements:**
- Super Admin only
- Character must exist
- Game must exist

**Usage:**
- `!assigngame Luna MyZoo` - Assign Luna character to MyZoo
- `!assigngame Max ZooBot` - Assign Max to ZooBot

**Response Example:**
```
✅ Character Luna has been assigned to MyZoo!
```

---

#### **`!bulkassign <game> <char1> <char2> <char3>...`**
Bulk assign multiple characters to a game.

**Requirements:**
- Super Admin only
- All characters must exist
- Game must exist

**Usage:**
- `!bulkassign MyZoo Luna Max Bella` - Assign 3 characters
- `!bulkassign ZooBot Leo Star Splash` - Assign 3 characters

**Response Example:**
```
✅ Successfully assigned 3 characters to MyZoo:
• Luna
• Max
• Bella
```

---

#### **`!importchars <source_game> <target_game> [char1 char2...]`**
Import characters from one game to another.

**Requirements:**
- Super Admin only
- Both games must exist
- Leave character names empty to import ALL

**Usage:**
- `!importchars ZooBot MyZoo` - Import ALL from ZooBot to MyZoo
- `!importchars ZooBot MyZoo Luna Max` - Import specific characters
- `!importchars RareCharacters MyZoo` - Import entire rare collection

**Response Example:**
```
✅ Successfully imported 2 characters from ZooBot to MyZoo:
• Luna (⭐)
• Max (⭐)

MyZoo now has 30 total characters
```

---

#### **`!backfillgames`**
Assign all existing characters to the default "ZooBot" game (if not already assigned).

**Requirements:**
- Super Admin only
- Used for data migration

**Usage:**
- `!backfillgames` - Backfill all unassigned characters

**Response Example:**
```
✅ Backfilled 52 characters to ZooBot game!
Updated 52 characters with game and creator metadata
```

---

## Character Submission System

### Overview
- **Purpose:** Allow players to design custom characters
- **Submission Format:** Name, Emoji, Obtainability, Optional Ability & Special Move
- **Approval Workflow:** Submit → Admin Review → Approve/Reject → Creator Notified
- **Default Game:** Submitted characters go to the server's selected game (or "ZooBot" if main server)
- **IDs:** Submissions use sequential IDs (SUB-00001, SUB-00002, etc.)

---

### User Commands

#### **`!submit <Character Info>`**
Submit a custom character for approval.

**Syntax:**
```
!submit Name|Emoji|Obtainable|[Ability,Emoji,Description,EffectType,Value]|[MoveName,Damage]
```

**Fields:**
- **Name:** 2-20 characters, character name
- **Emoji:** Any emoji
- **Obtainable:** How to get the character (crate, drop, trade, etc.)
- **Ability** (optional): Special passive ability with effect
- **Special Move** (optional): Attack move with damage

**Simple Examples:**
```
!submit Luna|🌙|crate
!submit Max|⭐|drop
!submit Splash|🌊|trade
```

**Full Examples with Ability:**
```
!submit Luna|🌙|crate|Moonlight,🌕,Heals 5% HP per turn,healPerTurn,0.05|Moon Beam,90
!submit Max|⭐|drop|Stellar Force,✨,Boosts damage by 10%,damageBoost,0.1|Cosmic Strike,95
!submit Fire|🔥|crate|Inferno,🔥,Deals 3% damage per turn,burnDamage,0.03|Blaze,85
```

**Available Effect Types:**
- `damageBoost` - Increase damage output
- `healPerTurn` - Heal per turn in battle
- `burnDamage` - Damage over time effect
- `reflectDamage` - Reflect damage back
- `stun` - Stun opponent
- `dodge` - Dodge attacks

**Response Example:**
```
✅ Character 🌙 Luna submitted for review!

📋 Submission ID: SUB-00001
🎮 Target Game: MyZoo
Ability: Moonlight - Heals 5% HP per turn
Special Move: Moon Beam (90 DMG)

Bot admins will review your submission and you'll be notified of the decision.
```

---

#### **`!mysubmissions`**
View all your character submissions (pending, approved, rejected).

**Usage:**
- `!mysubmissions`

**Response Example:**
```
📋 Your Submissions

⏳ SUB-00001 🌙 Luna → MyZoo
✅ SUB-00002 ⭐ Max → MyZoo
❌ SUB-00003 🌊 Splash → MyZoo

Total: 3 submissions
```

---

#### **`!cancelsub <submission_id>`**
Cancel your own pending submission.

**Requirements:**
- Must be the original submitter
- Submission must still be pending

**Usage:**
- `!cancelsub SUB-00001` - Cancel Luna submission

**Response Example:**
```
✅ Submission SUB-00001 (🌙 Luna) has been cancelled.
```

---

### Admin Commands

#### **`!submissions`** | **`!pendingsubs`**
View all pending character submissions.

**Requirements:**
- Bot Admin or Super Admin

**Usage:**
- `!submissions`

**Response Example:**
```
📋 Pending Character Submissions (3)

SUB-00001 🌙 Luna → MyZoo
  └ By: @PlayerName | 2 hours ago
SUB-00002 ⭐ Max → MyZoo
  └ By: @AnotherPlayer | 30 minutes ago
SUB-00003 🔥 Fire → ZooBot
  └ By: @NewPlayer | 5 minutes ago

Use !reviewsub <id> to see details
Use !approve <id> or !reject <id> [reason] to review
```

---

#### **`!reviewsub <submission_id>`**
View detailed information about a specific submission.

**Requirements:**
- Bot Admin or Super Admin

**Usage:**
- `!reviewsub SUB-00001`

**Response Example:**
```
🌙 Luna

Submission ID: SUB-00001
Status: ⏳ PENDING
Target Game: MyZoo
Obtainable: crate
Submitted By: <@PlayerID>
Submitted: 2 hours ago

Ability: 
🌕 Moonlight: Heals 5% HP per turn

Special Move:
⚔️ Moon Beam (90 DMG)
```

---

#### **`!approve <submission_id>`** | **`!approvechar`**
Approve a character submission and add it to the game.

**Requirements:**
- Bot Admin or Super Admin
- Submission must be pending
- Character name must not already exist

**Usage:**
- `!approve SUB-00001` - Approve Luna

**Response Example:**
```
✅ Character 🌙 Luna has been approved and added to MyZoo!

Creator: PlayerName
The character is now available in drops and crates!
```

**Player Notification (DM):**
```
🎉 Character Submission Approved!

Your character 🌙 Luna has been approved and added to the game!

Game/Bundle: MyZoo
Obtainable: crate
Submission ID: SUB-00001

Your character is now available in drops and crates!
```

---

#### **`!reject <submission_id> [reason]`** | **`!rejectchar`**
Reject a character submission with optional reason.

**Requirements:**
- Bot Admin or Super Admin
- Submission must be pending

**Usage:**
- `!reject SUB-00001` - Reject with no reason
- `!reject SUB-00001 Character name too similar to existing character` - Reject with reason

**Response Example:**
```
✅ Submission SUB-00001 (🌙 Luna) has been rejected.
```

**Player Notification (DM):**
```
❌ Character Submission Rejected

Your character 🌙 Luna was not approved.

Reason: Character name too similar to existing character
Submission ID: SUB-00001

You can submit a new character with improvements!
```

---

## Server Setup Flow

### New Server Setup Process

**Step 1: Create ZooAdmin Role**
```
In your Discord server, create a role called "ZooAdmin"
Assign to server admins who should manage the bot
```

**Step 2: Run Setup Command**
```
!setup
```

**Step 3: Select a Game**
```
!setgame ZooBot
or
!setgame MyCustomGame
```

**Step 4: Set Drop Channel**
```
!setdropchannel #drops
```

**Step 5: Set Events Channel**
```
!seteventschannel #events
```

**Step 6: Set Updates Channel**
```
!setupdateschannel #updates
```

**Step 7: Verify Setup**
```
!setupstatus
```

✅ **Setup Complete!** Your server is now ready to use the bot.

---

## Admin Commands

### Super Admin Game Management

| Command | Usage | Purpose |
|---------|-------|---------|
| `!games` | `!games` | List all available games |
| `!gameinfo` | `!gameinfo ZooBot` | View game details |
| `!creategame` | `!creategame MyZoo` | Create new game |
| `!deletegame` | `!deletegame MyZoo` | Delete a game |
| `!togglegame` | `!togglegame MyZoo` | Enable/disable game |
| `!gamestats` | `!gamestats` | View game statistics |
| `!assigngame` | `!assigngame Luna MyZoo` | Assign character to game |
| `!bulkassign` | `!bulkassign MyZoo Luna Max Bella` | Assign multiple characters |
| `!importchars` | `!importchars ZooBot MyZoo` | Import characters between games |
| `!backfillgames` | `!backfillgames` | Backfill unassigned characters |

### Super Admin Submission Management

| Command | Usage | Purpose |
|---------|-------|---------|
| `!submissions` | `!submissions` | View all pending submissions |
| `!reviewsub` | `!reviewsub SUB-00001` | View submission details |
| `!approve` | `!approve SUB-00001` | Approve character |
| `!reject` | `!reject SUB-00001 reason` | Reject character |

---

## Examples & Workflows

### Workflow 1: Create Custom Game & Populate with Characters

**Goal:** Create a "RareZoo" game with only rare characters

**Steps:**
```
1. !creategame RareZoo A collection of rare and exotic characters
   Response: ✅ RareZoo created!

2. !bulkassign RareZoo Phoenix Dragon Unicorn Kraken
   Response: ✅ Assigned 4 characters to RareZoo

3. !gameinfo RareZoo
   Response: Shows 4 characters, ready to use

4. Server admin uses: !setgame RareZoo
   Response: ✅ Server now uses RareZoo
```

**Result:** When players in that server catch drops or open crates, they only get Phoenix, Dragon, Unicorn, or Kraken.

---

### Workflow 2: Player Submits Custom Character for Approval

**Goal:** Player designs "Sparkle" character, gets it approved

**Steps:**
```
1. Player uses: !submit Sparkle|✨|crate|Shimmer,💫,Reduces damage by 5%,damageReduce,0.05|Sparkle Blast,80
   Response: ✅ Submitted as SUB-00001 to MyZoo

2. Admin views: !submissions
   Response: Shows SUB-00001 pending

3. Admin reviews: !reviewsub SUB-00001
   Response: Shows all details - name, emoji, ability, move

4. Admin approves: !approve SUB-00001
   Response: ✅ Sparkle added to MyZoo

5. Player receives DM:
   🎉 Character Submission Approved!
   Your character ✨ Sparkle has been approved...

6. Sparkle now appears in drops/crates for all servers using MyZoo
```

---

### Workflow 3: Server Switches Games

**Goal:** Switch server from ZooBot to PokemonStyle game

**Current State:**
- Server is using ZooBot
- Has 52 characters available
- Drops active

**Steps:**
```
1. Server admin uses: !setgame PokemonStyle
   Response: ✅ Server now using PokemonStyle (45 chars)

2. Result: Next drop only shows PokemonStyle characters

3. Admin checks: !setupstatus
   Response: Shows updated game selection
```

**Effect:** All drops/crates now use only PokemonStyle characters

---

### Workflow 4: Import Characters Between Games

**Goal:** Copy 10 rare characters from ZooBot to a new "VIPZoo" game

**Steps:**
```
1. Create VIPZoo: !creategame VIPZoo Premium exclusive characters

2. Check ZooBot chars: !bundlechars ZooBot
   Response: Lists all 52 characters

3. Import specific ones: !importchars ZooBot VIPZoo Luna Max Bella Phoenix Dragon Unicorn Kraken Sparkle Twilight Nova
   Response: ✅ Imported 10 characters

4. Verify: !gameinfo VIPZoo
   Response: Shows 10 characters ready
```

**Result:** VIPZoo now has a curated set of premium characters

---

## Key Features Summary

### Game/Bundle System
✅ Multiple games per bot instance  
✅ Per-server game selection  
✅ Character filtering in drops/crates  
✅ Game creation & deletion  
✅ Bulk character assignment  
✅ Character import between games  
✅ Game statistics  
✅ MongoDB persistence  

### Character Submission System
✅ Player-designed characters  
✅ Automatic approval workflow  
✅ Admin review interface  
✅ DM notifications  
✅ Submission history  
✅ Cancel pending submissions  
✅ Sequential submission IDs  
✅ Creator attribution  

### Server Setup
✅ Game selection requirement  
✅ Enhanced setup validation  
✅ Setup status checking  
✅ Channel configuration  
✅ Role-based permissions  

---

## Troubleshooting

### Issue: "Game not found"
**Solution:** Check spelling with `!games` to see exact name

### Issue: "Cannot activate drops - no game selected"
**Solution:** Use `!setgame <game>` to select a game first

### Issue: "Character submission shows empty game"
**Solution:** Your server must run `!setgame` before submitting. Submissions default to server's selected game.

### Issue: "No characters in game for drops"
**Solution:** Use `!assigngame` or `!bulkassign` to add characters to the game

### Issue: "Submission rejected - character name already exists"
**Solution:** Choose a different name - the character already exists in that game

---

## Support

For issues or questions about the Game/Bundle or Character Submission systems, contact a Super Admin or Bot Admin.
