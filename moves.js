const LOW_ST_MOVES = [
  { name: 'Punch', damage: 15 },
  { name: 'Kick', damage: 20 },
  { name: 'Block', damage: 0 },
  { name: 'Swipe', damage: 22 },
  { name: 'Charge', damage: 0 },
  { name: 'Heal', damage: -15 },
  { name: 'Taunt', damage: 0 },
  { name: 'Smack', damage: 25 },
  { name: 'Focus', damage: 0 },
  { name: 'Jab', damage: 18 }
];

const MID_ST_MOVES = [
  { name: 'Strike', damage: 40 },
  { name: 'Double Hit', damage: 45 },
  { name: 'Wind Cut', damage: 50 },
  { name: 'Guard', damage: 0 },
  { name: 'Power Up', damage: 0 },
  { name: 'Recover', damage: -30 },
  { name: 'Flame Hit', damage: 50 },
  { name: 'Frost Hit', damage: 48 },
  { name: 'Shock Hit', damage: 52 },
  { name: 'Counter', damage: 35 }
];

const HIGH_ST_MOVES = [
  { name: 'Smash', damage: 80 },
  { name: 'Meteor', damage: 100 },
  { name: 'Flash', damage: 95 },
  { name: 'Slice', damage: 85 },
  { name: 'Flame Burst', damage: 90 },
  { name: 'Wave', damage: 88 },
  { name: 'Thunder', damage: 95 },
  { name: 'Quake', damage: 100 },
  { name: 'Revive', damage: -60 },
  { name: 'Boost', damage: 0 }
];

const SPECIAL_MOVES = {
  'Bali': { name: 'Claw Rush', damage: 90 },
  'Betsy': { name: 'Sonic Peck', damage: 85 },
  'Bruce': { name: 'Power Slam', damage: 100 },
  'Buck': { name: 'Horn Charge', damage: 95 },
  'Buddy': { name: 'Happy Howl', damage: 85 },
  'Caly': { name: 'Leaf Shot', damage: 88 },
  'Dillo': { name: 'Shell Roll', damage: 90 },
  'Donna': { name: 'Charm Spin', damage: 88 },
  'Duke': { name: 'Royal Cut', damage: 95 },
  'Earl': { name: 'Hot Punch', damage: 90 },
  'Edna': { name: 'Web Strike', damage: 85 },
  'Elaine': { name: 'Petal Wave', damage: 88 },
  'Faye': { name: 'Sparkle Beam', damage: 90 },
  'Finn': { name: 'Tidal Wave', damage: 95 },
  'Frank': { name: 'Head Smash', damage: 100 },
  'Fuzzy': { name: 'Wild Leap', damage: 92 },
  'Henry': { name: 'Volt Bite', damage: 95 },
  'Iris': { name: 'Healing Ray', damage: 80 },
  'Jack': { name: 'Sneak Cut', damage: 90 },
  'Jade': { name: 'Stone Punch', damage: 92 },
  'Joy': { name: 'Light Shot', damage: 85 },
  'Larry': { name: 'Sneaky Swipe', damage: 88 },
  'Lennon': { name: 'Sound Blast', damage: 90 },
  'Lizzy': { name: 'Fire Breath', damage: 95 },
  'Louie': { name: 'Laser Beam', damage: 100 },
  'Max': { name: 'Fist Storm', damage: 92 },
  'Milo': { name: 'Vine Wrap', damage: 88 },
  'Molly': { name: 'Bubble Shot', damage: 85 },
  'Nico': { name: 'Spin Dash', damage: 90 },
  'Nina': { name: 'Moon Strike', damage: 88 },
  'Nix': { name: 'Frost Bite', damage: 95 },
  'Ollie': { name: 'Fire Burst', damage: 92 },
  'Paco': { name: 'Wind Kick', damage: 90 },
  'Paolo': { name: 'Gear Spin', damage: 95 },
  'Pepper': { name: 'Spice Bomb', damage: 88 },
  'Phil': { name: 'Mind Push', damage: 90 },
  'Poe': { name: 'Night Grip', damage: 90 },
  'Quinn': { name: 'Speed Cut', damage: 88 },
  'Ravi': { name: 'Storm Jab', damage: 92 },
  'Rocky': { name: 'Rock Toss', damage: 90 },
  'Romeo': { name: 'Heart Blast', damage: 85 },
  'Rubie': { name: 'Gem Strike', damage: 88 },
  'Shelly': { name: 'Shell Guard', damage: 85 },
  'Skippy': { name: 'Hop Smash', damage: 90 },
  'Steve': { name: 'Hammer Hit', damage: 95 },
  'Suzy': { name: 'Star Beam', damage: 88 },
  'Tony': { name: 'Twin Spin', damage: 95 },
  'Ursula': { name: 'Tide Crash', damage: 95 },
  'Wanda': { name: 'Floral Blast', damage: 88 },
  'Yara': { name: 'Sand Rush', damage: 90 },
  'Zac': { name: 'Steel Slam', damage: 100 }
};

function getMovesForST(st) {
  if (st <= 40) {
    return LOW_ST_MOVES;
  } else if (st <= 75) {
    return MID_ST_MOVES;
  } else {
    return HIGH_ST_MOVES;
  }
}

async function getSpecialMoveForCharacter(characterName) {
  if (SPECIAL_MOVES[characterName]) {
    return SPECIAL_MOVES[characterName];
  }
  
  try {
    const { getCustomCharacterSpecialMove } = require('./customCharacterManager.js');
    const customMove = await getCustomCharacterSpecialMove(characterName);
    if (customMove) {
      return customMove;
    }
  } catch (error) {
    console.error('Error getting custom character special move:', error);
  }
  
  return { name: 'Basic Attack', damage: 85 };
}

function getSpecialMoveSync(characterName) {
  return SPECIAL_MOVES[characterName] || null;
}

module.exports = {
  LOW_ST_MOVES,
  MID_ST_MOVES,
  HIGH_ST_MOVES,
  SPECIAL_MOVES,
  getMovesForST,
  getSpecialMoveForCharacter,
  getSpecialMoveSync
};
