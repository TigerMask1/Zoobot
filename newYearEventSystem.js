const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const PIECES_COUNT = 9;
const MILESTONE_POINTS = 50; // Points per piece
const POINTS_PER_BATTLE = 5;
const POINTS_PER_DROP = 10;

// Corner pieces first: Top-Left (0), Top-Right (2), Bottom-Left (6), Bottom-Right (8)
// Then others: Top-Middle (1), Middle-Left (3), Middle-Middle (4), Middle-Right (5), Bottom-Middle (7)
const UNLOCK_ORDER = [0, 2, 6, 8, 1, 3, 4, 5, 7];

function initializeNewYearData(user) {
  if (!user.newYearEvent) {
    user.newYearEvent = {
      points: 0,
      piecesUnlocked: [],
      battlesCompleted: 0,
      dropsCaught: 0,
      completed: false
    };
  }
  return user.newYearEvent;
}

function isEventActive() {
  const now = new Date();
  const endEvent = new Date('2026-01-03T00:00:00Z'); // Ends after January 2nd
  return now < endEvent;
}

async function recordEventProgress(data, userId, type) {
  if (!isEventActive()) return;

  if (!data || !data.users) return;
  const user = data.users[userId];
  if (!user) return;

  const event = initializeNewYearData(user);
  if (event.completed) return;

  if (type === 'battle') {
    event.battlesCompleted++;
    event.points += POINTS_PER_BATTLE;
  } else if (type === 'drop') {
    event.dropsCaught++;
    event.points += POINTS_PER_DROP;
  }

  // Check for new pieces
  const piecesShouldHave = Math.min(PIECES_COUNT, Math.floor(event.points / MILESTONE_POINTS));
  let newlyUnlocked = [];

  while (event.piecesUnlocked.length < piecesShouldHave) {
    const nextPieceIndex = UNLOCK_ORDER[event.piecesUnlocked.length];
    event.piecesUnlocked.push(nextPieceIndex);
    newlyUnlocked.push(nextPieceIndex);
  }

  if (piecesShouldHave === PIECES_COUNT && !event.completed) {
    event.completed = true;
    user.tyrantCrates = (user.tyrantCrates || 0) + 1;
    return { completed: true, newlyUnlocked };
  }

  return { completed: false, newlyUnlocked };
}

function getPuzzleDisplay(piecesUnlocked) {
  const grid = Array(3).fill(null).map(() => Array(3).fill('⬜'));
  piecesUnlocked.forEach(index => {
    const r = Math.floor(index / 3);
    const c = index % 3;
    grid[r][c] = '✅';
  });
  return grid.map(row => row.join(' ')).join('\n');
}

function createProgressBar(points, max) {
  const length = 12;
  const progress = Math.min(points / max, 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  const percent = Math.round(progress * 100);
  return `${'🟩'.repeat(filled)}${'⬜'.repeat(empty)} ${percent}%`;
}

module.exports = {
  initializeNewYearData,
  recordEventProgress,
  getPuzzleDisplay,
  createProgressBar,
  isEventActive,
  PIECES_COUNT,
  MILESTONE_POINTS,
  UNLOCK_ORDER
};
