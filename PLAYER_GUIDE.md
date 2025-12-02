# 🎮 Ultimate Player Guide - Discord Character Collection Bot

Welcome to the most comprehensive guide for mastering the Discord Character Collection Bot! This guide will teach you everything from your first steps to becoming a top player.

---

## 📚 Table of Contents

1. [Getting Started](#-getting-started)
2. [Understanding Your Profile](#-understanding-your-profile)
3. [The Character System](#-the-character-system)
4. [Economy & Currencies](#-economy--currencies)
5. [Leveling & Progress](#-leveling--progress)
6. [Battle System](#-battle-system)
7. [Crates & Rewards](#-crates--rewards)
8. [Trading System](#-trading-system)
9. [Quests & Achievements](#-quests--achievements)
10. [Skins & Customization](#-skins--customization)
11. [Events & Competition](#-events--competition)
12. [Advanced Strategies](#-advanced-strategies)
13. [Command Reference](#-command-reference)

---

## 🎯 Getting Started

### Your First Steps

#### 1. Starting Your Journey
```
!start
```
**What happens:**
- Creates your player account
- You receive ONE starter character (randomly chosen from Bruce 🦍, Buck 🐂, or Nix 🦊)
- Starting rewards: **200 Coins** and **5 Gems**
- Your character is automatically selected and ready for battles
- You begin with **200 Trophies**

**Important:** You can only use `!start` once! Choose wisely when you begin.

#### 2. Viewing Your Profile
```
!profile
```
**What you'll see:**
- 💰 **Coins**: Your primary currency
- 💎 **Gems**: Premium currency
- 🏆 **Trophies**: Competitive ranking (starts at 200)
- 🎮 **Characters**: How many you own out of 51 total
- 💬 **Messages**: Your message count
- ⭐ **Selected**: Your current battle character
- 🖼️ **Profile Picture**: The character displayed in your profile (can be different from selected!)

#### 3. Understanding Your Character
```
!char <character name>
```
Example: `!char Bruce`

**What you'll learn:**
- **Level**: Your character's current level
- **ST (Special Trait)**: A unique stat (0-100%) that affects HP and abilities
- **Tokens**: Progress toward next level (shown with beautiful visual progress bar)
- **Coins Required**: Cost to level up
- **Equipped Skin**: Current appearance
- **Owned Skins**: All skins you have for this character

---

## 👤 Understanding Your Profile

### Profile Customization (NEW!)

You can now choose which character appears as your profile picture!

#### Setting Your Profile Picture
```
!setprofilepic <character>
!setpfp <character>
```
Examples:
```
!setprofilepic Nix
!setpfp Bruce
```

**Key Features:**
- Display ANY character you own as your profile picture
- This is separate from your "Selected" battle character
- The character's current skin will be shown
- Use `!profile` to see your customized profile

**Why This Matters:**
- Show off your favorite character
- Keep your battle character private
- Display rare characters or cool skins
- Personalize your profile appearance

### Viewing Other Players
```
!profile @username
```
See another player's stats, characters, and customization!

---

## 🦁 The Character System

### How Characters Work

There are **51 unique characters** in the game, each with:
- Unique emoji/appearance
- Special Trait (ST) stat
- 3 predetermined moves
- Unique passive ability
- Upgradeable level
- HP scaling
- Custom skins

### Character Categories

#### Starter Characters (Choose 1)
- **Bruce** 🦍 - Gorilla
- **Buck** 🐂 - Bull  
- **Nix** 🦊 - Fox

#### Crate Characters (50 total)
All other characters can be obtained through:
- Opening crates
- Trading with players
- Unlocking with keys
- Event rewards

### Character Stats Explained

#### ST (Special Trait) - The Most Important Stat
- Range: 0.00% to 100.00%
- **Randomly assigned** when you get a character
- Affects base HP: `HP = 400 + (ST * 6)`
- Cannot be changed (except with ST Boosters)
- Higher ST = Higher HP = Better survivability

**Example:**
- Character with 50% ST: `400 + (50 * 6) = 700 HP`
- Character with 90% ST: `400 + (90 * 6) = 940 HP`

### Selecting Your Battle Character
```
!select <character>
```
Example: `!select Nix`

**Important:** 
- Your selected character is used in battles
- Your profile picture can be a different character
- You can change your selected character anytime
- You must own the character to select it

### Viewing Character Info
```
!char <name>    # Full character details
!i <name>       # Battle stats and moves
!info <name>    # Same as !i
```

**What `!i` Shows:**
- Base HP
- All 3 moves with damage/effects
- Energy costs
- Move types (Attack/Special/Heal)
- Unique passive ability
- Ability description

---

## 💰 Economy & Currencies

### The Four Currencies

#### 1. Coins 💰
**How to earn:**
- Every 25 messages: Free Bronze Crate (contains coins)
- Catch drops: `!c <code>` when drops appear
- Daily rewards: `!daily`
- Winning battles
- Opening crates
- Completing quests
- Releasing duplicate characters

**What it's used for:**
- Leveling up characters
- Buying battle items from shop
- Trading currency

**Starting amount:** 200 coins

#### 2. Gems 💎
**How to earn:**
- Catch gem drops (rare, 8% chance)
- Daily rewards
- Quest rewards
- Event rewards
- Admin grants

**What it's used for:**
- Buying premium crates
- Purchasing legendary items
- Trading

**Starting amount:** 5 gems

**Gem Value:** Gems are RARE - use them wisely!

#### 3. Trophies 🏆
**How to earn/lose:**
- Win battles: +15 trophies
- Lose battles: -5 trophies
- Event participation
- Cannot drop below 0

**What it's used for:**
- Competitive ranking
- Leaderboard position
- Bragging rights

**Starting amount:** 200 trophies

#### 4. Character Tokens 🎫
**How tokens work:**
- Each character has its own token type
- Tokens are tied to that specific character
- Used exclusively to level up that character
- Cannot be transferred between characters

**How to earn tokens:**
- Catch token drops: `!c <code>`
- Open crates (random character tokens)
- Event rewards
- Trade with players

**Visual Progress:**
Tokens now display with beautiful colored progress bars:
- 🟥 Red: 0-24% progress
- 🟧 Orange: 25-49% progress
- 🟨 Yellow: 50-74% progress
- 🟦 Blue: 75-99% progress
- 🟩 Green: 100% (ready to level!)

---

## ⬆️ Leveling & Progress

### How Leveling Works

Each character levels up independently using their specific tokens.

#### Level Requirements
Leveling up requires:
1. **Tokens** (increases each level)
2. **Coins** (increases each level)

**Formula:**
- Tokens needed: `Level * 50`
- Coins needed: `Level * 100`

**Examples:**
- Level 1→2: 50 tokens + 100 coins
- Level 2→3: 100 tokens + 200 coins
- Level 5→6: 250 tokens + 500 coins
- Level 10→11: 500 tokens + 1000 coins

#### Leveling Up Command
```
!levelup <character>
!lvlup <character>
```

**What happens:**
- Character level increases by 1
- Tokens and coins are consumed
- New token requirement is calculated
- Character gets stronger (higher max HP in future battles)

### Viewing Level Progress

Use `!char <name>` to see a beautiful visual progress bar showing your token collection progress!

**Example Display:**
```
🎫 🟨🟨🟨🟨🟨🟨⬜⬜⬜⬜⬜⬜ **150/250** (60%)
```

This shows you're 60% of the way to your next level!

---

## ⚔️ Battle System

### Types of Battles

#### 1. PvP Battles (Player vs Player)
```
!battle @player
!b @player
```

**How it works:**
- Challenge another player
- Turn-based combat system
- Winner gets +15 🏆, loser gets -5 🏆
- Strategic move selection
- Energy management crucial

#### 2. AI Battles
```
!b ai          # Normal difficulty
!b easy        # Easy difficulty
!b normal      # Normal difficulty  
!b hard        # Hard difficulty
```

**Difficulty Levels:**
- **Easy**: AI has 70% HP
- **Normal**: AI has 100% HP
- **Hard**: AI has 130% HP

**Note:** AI battles are available on the main server only

### Battle Mechanics

#### Energy System
- Start with **100 energy**
- Regenerate **20 energy per turn**
- Maximum **100 energy**
- Moves cost different amounts of energy

#### Move Types
1. **Basic Attacks** - Low energy cost, moderate damage
2. **Special Moves** - High energy cost, high damage/effects
3. **Healing Moves** - Restore HP

#### Status Effects
Battles include powerful status effects:
- **Burn** 🔥: Damage over time
- **Freeze** ❄️: Skip turns
- **Poison** ☠️: HP drain
- **Paralyze** ⚡: Can't move
- **Stun** 💫: Temporary disable
- **Regeneration** 💚: Heal over time

#### Critical Hits
- 15% base chance for critical hits
- Critical hits deal 1.5x damage
- Can turn the tide of battle!

#### Passive Abilities
Every character has a unique passive ability that activates during battle!

Examples:
- Counterattack when hit
- Extra damage on low HP
- Healing over time
- Damage reflection
- And 48 more unique abilities!

### Battle Items

#### Using the Shop
```
!shop
```

**Available Items:**
- **Healing Potion** (50 coins): Restore 100 HP
- **Energy Drink** (30 coins): Restore 40 energy
- **Attack Boost** (75 coins): +20% damage for 3 turns
- **Defense Shield** (75 coins): -20% incoming damage for 3 turns
- **Full Restore** (150 coins): Full HP + Full Energy
- **Revival Token** (200 coins): Auto-revive at 50% HP

#### Using Items in Battle
```
!use <item>
```

**Strategy Tips:**
- Save healing items for critical moments
- Energy drinks can enable powerful moves
- Boosts can secure early advantages
- Plan your item usage carefully!

---

## 🔑 Character Keys System

### What Are Character Keys?

Character Keys are a new alternative way to unlock characters! Instead of relying on crate luck, you can collect **750 keys** for any specific character and unlock them directly.

#### How It Works
- Each character has their own type of key (e.g., "Nix Keys", "Bruce Keys")
- Collect 750 keys for a character to unlock them
- Keys only work for characters in your server's selected game bundle
- Keys drop during **Key Rush** events and rarely during normal gameplay

### Getting Character Keys

#### Key Rush Events 🔥
Special 1-hour events where **ALL drops become character keys!**

**Main Server:**
- Automatic Key Rush at **10:00 UTC**, **16:00 UTC**, and **22:00 UTC** daily
- No payment needed - always active

**Other Servers:**
- ZooAdmins can activate with `!keyrush` (costs 250 gems, lasts 1 hour)
- Super Admins can grant free Key Rush with `!grantkeyrush`

**During Key Rush:**
- Keys drop every 45 seconds (main server) or 60 seconds (other servers)
- Drops are 1-3 keys for a random character
- Type `!c <code>` to catch them quickly!

#### Normal Gameplay Drops
- **5% chance** for character keys to drop during regular gameplay
- Drops 1-2 keys when triggered
- Random character from your server's bundle

### Commands

#### View Your Key Collection
```
!charkeys
!ck
```

**Shows:**
- Beautiful progress bars for each character
- How many keys you have (current/750)
- Which characters you can unlock (🔓 icon)
- Interactive menu to unlock characters directly

**Progress Bar Colors:**
- 🔒 Locked: Under 750 keys
- 🔓 Ready: 750+ keys available
- ✅ Owned: Character already unlocked

#### Unlock a Character
```
!keyunlock <character name>
```

Examples:
```
!keyunlock Nix
!keyunlock Bruce
!keyunlock Donna the Diva
```

**Requirements:**
- Must have 750+ keys for that character
- Character must be in your server's bundle
- You must not already own the character

**What happens:**
- 750 keys are consumed
- Character is unlocked with random ST (0-100%)
- Character starts at Level 1
- You can use them immediately!

#### Convert Excess Keys
```
!convertkeys
```

**Auto-converts** all excess keys for characters you already own into tokens (1:1 ratio).

**Example:**
- You own Nix and have 850 Nix keys
- Running `!convertkeys` gives you 850 Nix tokens
- Your Nix keys reset to 0

**Pro Tip:** Keys for owned characters auto-convert when you catch them during drops!

#### Check Key Rush Status
```
!keyrushstatus
```

**Shows:**
- Whether Key Rush is currently active
- Time remaining
- Which server it's active on

#### Activate Key Rush (ZooAdmin Only)
```
!keyrush
```

**Requirements:**
- ZooAdmin role or higher
- 250 gems (consumed on activation)
- Not available on main server (always active there)

**Grants:**
- 1 hour of Key Rush
- All drops become character keys
- Members can collect keys rapidly

### Key Rush Strategy

#### Best Times to Play
**Main Server:**
- 10:00 UTC - First daily Key Rush
- 16:00 UTC - Afternoon Key Rush
- 22:00 UTC - Evening Key Rush

**Other Servers:**
- Ask ZooAdmins to activate during peak hours
- Coordinate with your server community

#### Maximizing Your Keys
1. **Stay Active** during Key Rush hours
2. **Type fast** - keys are first-come, first-served
3. **Focus on one character** you want to unlock
4. **Convert excess keys** to tokens for characters you own
5. **Check progress** with `!charkeys` regularly

#### Smart Collection Tips
- **Target rare characters** you haven't pulled from crates
- **Collect keys for high-value characters** in your server's bundle
- **Don't waste** keys on characters you already own (auto-convert instead)
- **Participate in all Key Rush events** for maximum efficiency

### Key Drop Mechanics

#### During Key Rush
- **Drop Rate:** Every 45s (main server) or 60s (other servers)
- **Amount:** 1-3 keys per drop
- **Character:** Random from server's game bundle
- **Catch:** Type `!c <code>` shown in the drop message

#### Normal Gameplay
- **Drop Chance:** 5% of all drops
- **Amount:** 1-2 keys per drop
- **Character:** Random from server's bundle
- **Rarity:** Between shards (2%) and tokens (55%)

### Visual Progress Tracking

The `!charkeys` menu shows beautiful visual progress:

```
🦊 Nix 🔓
🔑 ███████████████░░░░░ 750/750 (100%)

🦍 Bruce 🔒
🔑 ██████░░░░░░░░░░░░░░ 200/750 (27%)

🐂 Buck ✅
🔑 ████████████████████ 850/750 (Owned)
```

**Icons:**
- 🔒 = Locked (under 750 keys)
- 🔓 = Ready to unlock!
- ✅ = Already owned

### FAQ

**Q: Can I trade character keys?**
A: Not yet, but it's planned for future updates!

**Q: Do keys expire?**
A: No! Keys stay in your collection forever until used.

**Q: What happens if I get keys for a character I own?**
A: They auto-convert to tokens (1:1) when you catch them!

**Q: Can I unlock characters not in my server's bundle?**
A: No, you can only unlock characters from your server's selected game.

**Q: How many keys do I need?**
A: Always **750 keys** for any character.

**Q: Can I get keys without Key Rush?**
A: Yes! There's a 5% chance during normal drops.

**Q: Do keys carry over between servers?**
A: Yes! Your key collection is account-wide, but unlocks must follow each server's bundle.

---

## 🎰 Minigames System

### Available Minigames

ZooBot features **5 exciting minigames** to test your luck and win big!

**Main Server Bonus:** Players on the main server receive **1.5× rewards** on all minigames!

#### 1. Coin Duel 🪙
```
!coinduel <h/t> <bet>
```
- Classic coin flip: Heads or Tails
- 50% win chance
- 2× payout on win

#### 2. Dice Clash 🎲
```
!diceclash <bet>
```
- Roll dice against the house
- Beat the house roll to win
- Variable payout based on roll difference

#### 3. Door of Fate 🚪
```
!dooroffate <bet>
```
- Choose from 3 doors
- One door has the prize
- 33% win chance, 3× payout

#### 4. Rock Paper Scissors ✊
```
!rps <r/p/s> <bet>
```
- Classic RPS against the bot
- Win: 2× payout
- Draw: Bet returned

#### 5. Almost Win Machine 🎰
```
!almostwin <bet>
```
- Guess a number from 1-10
- Exact match: 10× payout
- Close (±1): 2× payout
- Very close excitement!

### Minigame Strategy
- **Start small** - Test the waters with low bets
- **Main server advantage** - Play there for 1.5× rewards
- **Know the odds** - Door of Fate has best big-win potential
- **Set limits** - Don't gamble more than you can afford to lose
- **Mix it up** - Try different games to keep it fun!

## 🎁 Crates & Rewards

### Crate Types & Probabilities

#### Free Crates

**Bronze Crate** 🟫
- Earned: Every 25 messages
- Contains: Small amount of coins
- Free to open
- Command: `!opencrate bronze`

**Silver Crate** ⚪
- Earned: Every 50 messages
- Contains: Moderate coins
- Free to open
- Command: `!opencrate silver`

#### Premium Crates (Purchase with Gems)

**Gold Crate** 🥇
- Cost: 💎 100 gems
- Character chance: 1.5%
- Random tokens: 50
- Coins: 500
- Commands: `!crate gold` (buy) | `!opencrate gold` (open)

**Emerald Crate** 🟢
- Cost: 💎 250 gems
- Character chance: 5%
- Random tokens: 130
- Coins: 1800
- Commands: `!crate emerald`

**Legendary Crate** 🔥
- Cost: 💎 500 gems
- Character chance: 10%
- Random tokens: 200
- Coins: 2500
- Commands: `!crate legendary`

**Tyrant Crate** 👑
- Cost: 💎 750 gems
- Character chance: 15%
- Random tokens: 300
- Coins: 3500
- Commands: `!crate tyrant`

### Drop System

**NEW PAID MODEL:**
- **Main Server:** Unlimited FREE drops every 20-30 seconds!
- **Other Servers:** Pay 100 gems for 3 hours of drops (`!paydrops`)
  - Auto-pauses after 30 uncaught drops to save resources
  - Use `!revivedrops` to resume after inactivity

Every 20-30 seconds (depending on server), a random drop appears in the drop channel!

#### How to Catch Drops
```
!c <code>
!catch <code>
```

Example codes: `tyrant`, `zooba`, `zoo`, `catch`, `grab`, `quick`, `fast`, `win`, `get`, `take`

**When a drop appears:**
1. A message shows what's dropped
2. A random code is given
3. Type `!c <code>` as fast as possible
4. First person gets the reward!

#### Drop Types & Chances
- **Tokens** (60%): 1-10 tokens for a random owned character
- **Coins** (30%): 1-10 coins
- **Gems** (8%): 1-2 gems
- **Shards** (2%): 1-2 shards (ultra rare!)

**Pro Tip:** Uncaught drops stay in chat now - no pressure if you miss one!

### Daily Rewards
```
!daily
```

**Cooldown:** Once per 24 hours

**Rewards:**
- Coins: 50-150
- Gems: 1-3
- Sometimes bonus tokens!

**Strategy:** Claim every day for consistent income!

---

## 🔄 Trading System

### How to Trade

#### Initiating a Trade
```
!trade @player
```

**The Trading Process:**
1. Sender initiates trade
2. **Both players** must add items
3. **Both players** must confirm
4. Trade executes automatically

#### Adding Items to Trade
```
!addchar <character>    # Add a character
!addcoins <amount>      # Add coins
!addgems <amount>       # Add gems
!addtokens <character> <amount>  # Add character tokens
```

**Examples:**
```
!addchar Nix
!addcoins 500
!addgems 10
!addtokens Bruce 50
```

#### Confirming Trade
```
!confirm
```

**Both players must confirm!** Trade won't execute until both parties agree.

#### Canceling Trade
```
!cancel
```

Either player can cancel before both confirm.

### Trading Tips
- Always verify what you're receiving
- Check character ST values before trading
- Negotiate fairly
- Don't trade away your only battle character!
- Screenshot valuable trades for your records

---

## 🎯 Quests & Achievements

### Quest System

#### Viewing Available Quests
```
!quests
!q
```

**Quest Categories:**
1. **Battle Quests** - Win battles, achieve streaks
2. **Collection Quests** - Collect characters, open crates
3. **Activity Quests** - Catch drops, send messages
4. **Progression Quests** - Level up, boost characters

#### Quest Rewards
- Coins
- Gems
- Shards
- Character tokens
- Special items

#### Claiming Completed Quests
```
!claim <quest_id>
```

Quests auto-track your progress - just claim when complete!

### Personalized Tasks

The bot sends you **personalized tasks** based on your activity!

**How it works:**
- Inactive players get tasks to re-engage
- Active players get bonus challenges
- Tasks expire after set time
- Rewards scale with difficulty

**Commands:**
```
!pttoggle    # Turn personalized tasks on/off
```

---

## 🎨 Skins & Customization

### Understanding Skins

Skins are **cosmetic appearances** for your characters that:
- Change how they look in your profile
- Display in battles and embeds
- Show your style and collection
- Don't affect stats or gameplay

Every character starts with the **default** skin.

### Viewing Available Skins
```
!skins <character>
```

Example: `!skins Nix`

Shows all skins available for that character (both owned and unowned).

### Equipping Skins
```
!equipskin <character> <skin_name>
```

Example: `!equipskin Nix galaxy`

**Requirements:**
- You must own the character
- You must own the skin
- Skin names are case-sensitive

### Profile Picture with Skins

When you set your profile picture, it uses your character's **currently equipped skin**!

**Example Workflow:**
1. `!equipskin Nix galaxy` - Equip the galaxy skin on Nix
2. `!setprofilepic Nix` - Set Nix as your profile picture
3. Your profile now shows Nix with the galaxy skin! ✨

### Getting New Skins

Skins are typically granted by:
- Admins for events
- Special achievements
- Community contests
- Seasonal rewards

---

## 🏆 Events & Competition

### Daily Events

The bot runs **competitive daily events** that rotate automatically!

#### Event Types

**1. Trophy Hunt** 🏆
- Goal: Earn the most trophies
- How: Win battles against players
- Duration: 24 hours
- Rewards: Top 3 players get prizes

**2. Crate Master** 🎁
- Goal: Open the most crates
- How: Buy and open premium crates
- Duration: 24 hours
- Rewards: Top 3 players get prizes

**3. Drop Catcher** 💨
- Goal: Catch the most drops
- How: Be fastest to catch drops
- Duration: 24 hours
- Rewards: Top 3 players get prizes

#### Event Commands
```
!event          # View current event
!eventinfo      # Detailed event info
!participants   # See all participants and rankings
```

#### Event Rewards

**Top 3 Winners Receive:**
- **1st Place**: 5 Cage Keys 🗝️ + 1 Legendary Crate
- **2nd Place**: 3 Cage Keys 🗝️ + 1 Emerald Crate
- **3rd Place**: 1 Cage Key 🗝️ + 2 Gold Crates

**Rewards are automatic!** No claiming needed - rewards are added directly to your account when the event ends.

### Auto Giveaways & Lottery

#### Automatic Giveaways 🎉
The bot runs **automatic giveaways daily** at 00:00 UTC!

**How it works:**
- Starts automatically at 00:00 UTC every day
- Runs for 60 minutes
- Prize: **500 gems** to the winner
- Winner announced in events channel across ALL servers
- Free to participate - just react to enter!

**Commands:**
```
!giveaway         # View current giveaway info
!nextgiveaway     # Check when next auto giveaway starts
```

**For Admins:**
```
!autogiveaway enable/disable    # Toggle auto giveaways
!startgiveaway <minutes>        # Start manual giveaway
!endgiveaway                    # End current giveaway
```

#### Automatic Lottery 🎟️
The bot runs **automatic lottery daily** at 00:00 UTC!

**How it works:**
- Starts automatically at 00:00 UTC every day
- Runs for 60 minutes
- Configurable ticket price (gems or coins)
- Winner gets the entire prize pool!
- Announced in events channel

**Commands:**
```
!lottery                    # View current lottery info
!lottery join <tickets>     # Buy tickets to enter
!nextlottery               # Check when next auto lottery starts
```

**For Admins:**
```
!autolottery enable/disable <fee> <currency>    # Toggle and configure
!startlottery <duration> <fee> <currency>       # Manual lottery
!stoplottery                                     # Stop current lottery
```

**Pro Tips:**
- Both systems cycle automatically at 00:00 UTC
- If manually started, auto systems wait until completion
- Winners announced to all servers in events channels
- Join the main server for giveaway announcements!

### Key & Cage System

#### Character-Specific Keys
```
!keys           # View all your keys
!unlock <character>  # Unlock character with 1000 keys
```

**How it works:**
- Each character has its own key type
- Collect 1000 keys for a character
- Unlock that specific character permanently
- Keys are earned from events and rewards

#### Cage Keys (Random Unlock)
```
!cage           # Open a random cage with 250 cage keys
```

**How it works:**
- Cage keys are universal (not character-specific)
- Collect 250 cage keys
- Unlock a random character you don't own yet
- Main way to get characters from event rewards

### Leaderboards
```
!lb coins       # Top coin holders
!lb gems        # Top gem holders  
!lb battles     # Most battle wins
!lb collectors  # Most characters owned
!lb trophies    # Highest trophy counts
```

**Compete for the top spot!**

---

## 🧠 Advanced Strategies

### Optimal Leveling Strategy

1. **Focus on High ST Characters**
   - Characters with 80%+ ST have best HP
   - Prioritize leveling your strongest STs
   - Check ST with `!char <name>`

2. **Token Collection Priority**
   - Catch every drop you can
   - Focus on drops for characters you use
   - Trade for tokens you need

3. **Coin Management**
   - Save coins for high-level upgrades
   - Don't waste on low-impact levels
   - Keep emergency fund for shop items

### Battle Strategy

1. **Energy Management**
   - Don't waste energy early
   - Save for powerful special moves
   - Balance attacks and energy regen

2. **Status Effect Timing**
   - Apply burn/poison early for max damage
   - Save freeze/stun for enemy power moves
   - Heal during opponent's weak turns

3. **Item Usage**
   - Don't use items too early
   - Save revival tokens for close battles
   - Boosts are best used mid-battle

### Crate Opening Strategy

1. **Free Crates**
   - Open immediately (Bronze/Silver)
   - No reason to save them

2. **Premium Crates**
   - Save gems for Tyrant crates (best odds)
   - Only buy Legendary+ for characters
   - Open during events for bonus rewards

### Trading Strategy

1. **Know Character Values**
   - High ST characters = more valuable
   - Rare characters = premium prices
   - Level doesn't transfer much value

2. **Fair Trade Guidelines**
   - 80%+ ST ≈ 70-79% ST + coins
   - Gems are worth 10-15x coins
   - Rare characters worth 2-3 common ones

3. **What to Trade Away**
   - Duplicate characters
   - Low ST duplicates
   - Excess tokens for characters you don't use

### Event Winning Tips

**Trophy Hunt:**
- Battle during peak hours
- Use high-ST characters
- Don't battle when tilted (lose trophies!)

**Crate Master:**
- Save gems beforehand
- Open early to set the pace
- Watch leaderboard, adjust strategy

**Drop Catcher:**
- Set up notifications
- Stay active during event
- Practice typing drop codes fast

---

## 📖 Command Reference

### Essential Commands (Quick Reference)

**Getting Started:**
- `!start` - Begin your journey
- `!select <char>` - Choose battle character
- `!profile` - View your profile

**Customization:**
- `!setprofilepic <char>` or `!setpfp <char>` - Set profile picture character

**Characters:**
- `!char <name>` - Character details
- `!i <name>` - Battle info
- `!levelup <name>` - Level up character

**Economy:**
- `!daily` - Daily rewards
- `!c <code>` - Catch drops

**Crates:**
- `!crate <type>` - Buy crate with gems
- `!opencrate <type>` - Open owned crate

**Battle:**
- `!battle @user` or `!b @user` - Challenge player
- `!b ai` - Fight AI
- `!shop` - View battle items

**Trading:**
- `!trade @user` - Start trade
- `!addchar <char>` - Add character to trade
- `!addcoins <amount>` - Add coins
- `!confirm` - Confirm trade

**Quests & Events:**
- `!quests` or `!q` - View quests
- `!event` - View current event
- `!lb <type>` - View leaderboards

**Skins:**
- `!skins <char>` - View available skins
- `!equipskin <char> <skin>` - Equip skin

**Keys:**
- `!keys` - View your keys
- `!unlock <char>` - Unlock with 1000 keys
- `!cage` - Open random cage (250 keys)

---

## 🎓 Frequently Asked Questions

### Q: Can I change my starter character?
**A:** No, your starter choice is permanent. Choose wisely!

### Q: What's the difference between Selected Character and Profile Picture?
**A:** 
- **Selected Character**: Used in battles
- **Profile Picture**: Displayed in your profile (cosmetic only)
- They can be different characters!

### Q: How do I get more characters?
**A:**
- Open crates (best method)
- Trade with players
- Unlock with character keys (1000 keys)
- Use cage keys (250 keys for random character)
- Win events

### Q: What does ST mean and why does it matter?
**A:** ST (Special Trait) determines your character's base HP. Higher ST = More HP = Better survival in battles. It's randomly assigned when you get a character and ranges from 0-100%.

### Q: Can I lose trophies?
**A:** Yes! You lose 5 trophies when you lose a battle, but gain 15 when you win. You cannot drop below 0 trophies.

### Q: How often do drops appear?
**A:** Every 20 seconds in the designated drop channel!

### Q: Do uncaught drops disappear?
**A:** Not anymore! Uncaught drops now stay in the chat instead of being deleted. This reduces server load.

### Q: Can I trade gems?
**A:** Yes! Use `!addgems <amount>` during a trade.

### Q: How do I get shards?
**A:** Shards are ultra-rare (2% drop chance). Catch drops and get lucky!

### Q: Are event rewards automatic?
**A:** Yes! Top 3 winners receive their rewards automatically when the event ends. No claiming needed.

### Q: Can I have multiple profile pictures?
**A:** No, but you can change it anytime using `!setprofilepic <character>`!

---

## 🌟 Pro Tips

1. **Active Play = More Rewards**
   - Message regularly for free crates (every 25/50 messages)
   - Catch drops (every 20 seconds)
   - Claim daily rewards
   - Participate in events

2. **Visual Progress Tracking**
   - The new colored progress bars make it easy to see token progress at a glance
   - 🟩 Green bar = Ready to level up!
   - Plan your leveling around the visual indicators

3. **Profile Customization**
   - Show off your rarest character
   - Display your favorite skin
   - Keep opponents guessing your battle character
   - Change it to match your mood!

4. **Resource Management**
   - Don't hoard everything - use items strategically
   - Invest in characters you actively use
   - Keep some gems saved for good crate sales
   - Maintain coin buffer for unexpected opportunities

5. **Community Engagement**
   - Fair trades build reputation
   - Help new players
   - Share strategies
   - Participate in events
   - Join server discussions

---

## 📞 Need Help?

If you're stuck or have questions:
- Check this guide first
- Use `!help` for command list
- Ask in the server chat
- Contact server moderators
- Report bugs to admins

---

## 🎉 Final Thoughts

This bot offers deep gameplay with:
- ✅ 51 unique characters to collect
- ✅ Strategic turn-based battles
- ✅ Multiple progression systems
- ✅ Competitive events
- ✅ Trading economy
- ✅ Visual customization
- ✅ Beautiful progress tracking
- ✅ Regular updates and events

**The journey is long, but rewarding. Good luck, and have fun collecting!** 🎮

---

*Last Updated: November 14, 2025*  
*Guide Version: 2.0 - Visual Enhancements Update*
