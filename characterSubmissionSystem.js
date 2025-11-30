const { getCollection } = require('./mongoManager.js');
const { isSuperAdmin, isBotAdmin, getServerConfig } = require('./serverConfigManager.js');
const { getServerGame, DEFAULT_GAME } = require('./gameSystem.js');
const { EmbedBuilder } = require('discord.js');

let submissions = {};
let submissionCounter = 0;

async function loadSubmissions() {
  try {
    const collection = await getCollection('characterSubmissions');
    const submissionsDoc = await collection.findOne({ _id: 'submissions_data' });
    
    if (submissionsDoc) {
      submissions = submissionsDoc.submissions || {};
      submissionCounter = submissionsDoc.counter || 0;
      console.log(`✅ Loaded ${Object.keys(submissions).length} character submissions`);
    } else {
      submissions = {};
      submissionCounter = 0;
    }
    
    return submissions;
  } catch (error) {
    console.error('Error loading submissions:', error);
    return {};
  }
}

async function saveSubmissions() {
  try {
    const collection = await getCollection('characterSubmissions');
    await collection.updateOne(
      { _id: 'submissions_data' },
      { 
        $set: { 
          submissions: submissions,
          counter: submissionCounter,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error saving submissions:', error);
    return false;
  }
}

function generateSubmissionId() {
  submissionCounter++;
  return `SUB-${submissionCounter.toString().padStart(5, '0')}`;
}

async function submitCharacter(userId, username, serverId, charData) {
  const { name, emoji, obtainable, ability, specialMove } = charData;
  
  if (!name || !emoji) {
    return { success: false, message: '❌ Character name and emoji are required!' };
  }
  
  if (name.length < 2 || name.length > 20) {
    return { success: false, message: '❌ Character name must be 2-20 characters!' };
  }
  
  const existingSubmission = Object.values(submissions).find(
    s => s.name.toLowerCase() === name.toLowerCase() && s.status === 'pending'
  );
  
  if (existingSubmission) {
    return { success: false, message: `❌ A character named "${name}" is already pending review!` };
  }
  
  const serverGame = getServerGame(serverId) || DEFAULT_GAME;
  
  const submissionId = generateSubmissionId();
  
  submissions[submissionId] = {
    id: submissionId,
    name: name.trim(),
    emoji: emoji.trim(),
    obtainable: obtainable || 'crate',
    ability: ability || null,
    specialMove: specialMove || null,
    submittedBy: userId,
    submitterName: username,
    serverId: serverId,
    targetGame: serverGame,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null
  };
  
  await saveSubmissions();
  
  return { 
    success: true, 
    message: `✅ Character **${emoji} ${name}** submitted for review!\n\n📋 Submission ID: \`${submissionId}\`\n🎮 Target Game: **${serverGame}**\n\nBot admins will review your submission and you'll be notified of the decision.`,
    submissionId: submissionId,
    submission: submissions[submissionId]
  };
}

async function approveSubmission(submissionId, reviewerId, characterManager, client = null) {
  const submission = submissions[submissionId];
  
  if (!submission) {
    return { success: false, message: `❌ Submission "${submissionId}" not found!` };
  }
  
  if (submission.status !== 'pending') {
    return { success: false, message: `❌ This submission has already been ${submission.status}!` };
  }
  
  const existingChar = characterManager.getCharacterByName(submission.name);
  if (existingChar) {
    submission.status = 'rejected';
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = new Date().toISOString();
    submission.reviewNote = 'Character with this name already exists';
    await saveSubmissions();
    return { success: false, message: `❌ A character named "${submission.name}" already exists in the game!` };
  }
  
  const charData = {
    name: submission.name,
    emoji: submission.emoji,
    obtainable: submission.obtainable,
    ability: submission.ability,
    specialMove: submission.specialMove,
    game: submission.targetGame,
    createdBy: submission.submitterName
  };
  
  const createResult = await characterManager.createCharacterFromSubmission(charData);
  
  if (!createResult.success) {
    return { success: false, message: createResult.message };
  }
  
  submission.status = 'approved';
  submission.reviewedBy = reviewerId;
  submission.reviewedAt = new Date().toISOString();
  
  await saveSubmissions();
  
  if (client) {
    try {
      const submitter = await client.users.fetch(submission.submittedBy).catch(() => null);
      if (submitter) {
        const approvalEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 Character Submission Approved!')
          .setDescription(`Your character **${submission.emoji} ${submission.name}** has been approved and added to the game!`)
          .addFields(
            { name: 'Game/Bundle', value: submission.targetGame, inline: true },
            { name: 'Obtainable', value: submission.obtainable, inline: true },
            { name: 'Submission ID', value: submissionId, inline: true }
          )
          .setFooter({ text: 'Your character is now available in drops and crates!' })
          .setTimestamp();
        
        await submitter.send({ embeds: [approvalEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error('Error notifying submitter:', error);
    }
  }
  
  return { 
    success: true, 
    message: `✅ Character **${submission.emoji} ${submission.name}** has been approved and added to **${submission.targetGame}**!`,
    character: createResult.character
  };
}

async function rejectSubmission(submissionId, reviewerId, reason = null, client = null) {
  const submission = submissions[submissionId];
  
  if (!submission) {
    return { success: false, message: `❌ Submission "${submissionId}" not found!` };
  }
  
  if (submission.status !== 'pending') {
    return { success: false, message: `❌ This submission has already been ${submission.status}!` };
  }
  
  submission.status = 'rejected';
  submission.reviewedBy = reviewerId;
  submission.reviewedAt = new Date().toISOString();
  submission.reviewNote = reason || 'No reason provided';
  
  await saveSubmissions();
  
  if (client) {
    try {
      const submitter = await client.users.fetch(submission.submittedBy).catch(() => null);
      if (submitter) {
        const rejectionEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Character Submission Rejected')
          .setDescription(`Your character **${submission.emoji} ${submission.name}** was not approved.`)
          .addFields(
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
            { name: 'Submission ID', value: submissionId, inline: true }
          )
          .setFooter({ text: 'You can submit a new character with improvements!' })
          .setTimestamp();
        
        await submitter.send({ embeds: [rejectionEmbed] }).catch(() => {});
      }
    } catch (error) {
      console.error('Error notifying submitter:', error);
    }
  }
  
  return { 
    success: true, 
    message: `✅ Submission **${submissionId}** (${submission.emoji} ${submission.name}) has been rejected.`
  };
}

function getPendingSubmissions(serverId = null) {
  return Object.values(submissions).filter(s => {
    if (s.status !== 'pending') return false;
    if (serverId && s.serverId !== serverId) return false;
    return true;
  });
}

function getAllSubmissions(status = null) {
  if (!status) return Object.values(submissions);
  return Object.values(submissions).filter(s => s.status === status);
}

function getSubmission(submissionId) {
  return submissions[submissionId] || null;
}

function getUserSubmissions(userId) {
  return Object.values(submissions).filter(s => s.submittedBy === userId);
}

function formatSubmissionEmbed(submission) {
  const statusColors = {
    pending: '#FFA500',
    approved: '#00FF00',
    rejected: '#FF0000'
  };
  
  const statusEmojis = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌'
  };
  
  const embed = new EmbedBuilder()
    .setColor(statusColors[submission.status] || '#808080')
    .setTitle(`${statusEmojis[submission.status]} ${submission.emoji} ${submission.name}`)
    .addFields(
      { name: 'Submission ID', value: submission.id, inline: true },
      { name: 'Status', value: submission.status.toUpperCase(), inline: true },
      { name: 'Target Game', value: submission.targetGame, inline: true },
      { name: 'Obtainable', value: submission.obtainable, inline: true },
      { name: 'Submitted By', value: `<@${submission.submittedBy}>`, inline: true },
      { name: 'Submitted', value: `<t:${Math.floor(new Date(submission.submittedAt).getTime() / 1000)}:R>`, inline: true }
    );
  
  if (submission.ability) {
    embed.addFields({
      name: 'Ability',
      value: `${submission.ability.emoji || '⭐'} **${submission.ability.name}**: ${submission.ability.description || 'No description'}`,
      inline: false
    });
  }
  
  if (submission.specialMove) {
    embed.addFields({
      name: 'Special Move',
      value: `⚔️ **${submission.specialMove.name}** (${submission.specialMove.damage} DMG)`,
      inline: false
    });
  }
  
  if (submission.status !== 'pending' && submission.reviewedBy) {
    embed.addFields(
      { name: 'Reviewed By', value: `<@${submission.reviewedBy}>`, inline: true },
      { name: 'Reviewed', value: `<t:${Math.floor(new Date(submission.reviewedAt).getTime() / 1000)}:R>`, inline: true }
    );
    
    if (submission.reviewNote) {
      embed.addFields({ name: 'Review Note', value: submission.reviewNote, inline: false });
    }
  }
  
  return embed;
}

function formatPendingList() {
  const pending = getPendingSubmissions();
  
  if (pending.length === 0) {
    return 'No pending character submissions.';
  }
  
  let list = `**📋 Pending Character Submissions (${pending.length})**\n\n`;
  
  for (const sub of pending) {
    list += `\`${sub.id}\` ${sub.emoji} **${sub.name}** → ${sub.targetGame}\n`;
    list += `  └ By: <@${sub.submittedBy}> | <t:${Math.floor(new Date(sub.submittedAt).getTime() / 1000)}:R>\n`;
  }
  
  list += `\nUse \`!reviewsub <id>\` to see details\n`;
  list += `Use \`!approve <id>\` or \`!reject <id> [reason]\` to review`;
  
  return list;
}

async function cancelSubmission(submissionId, userId) {
  const submission = submissions[submissionId];
  
  if (!submission) {
    return { success: false, message: `❌ Submission "${submissionId}" not found!` };
  }
  
  if (submission.submittedBy !== userId && !isSuperAdmin(userId)) {
    return { success: false, message: '❌ You can only cancel your own submissions!' };
  }
  
  if (submission.status !== 'pending') {
    return { success: false, message: `❌ This submission has already been ${submission.status}!` };
  }
  
  submission.status = 'cancelled';
  submission.reviewedAt = new Date().toISOString();
  submission.reviewNote = 'Cancelled by submitter';
  
  await saveSubmissions();
  
  return { 
    success: true, 
    message: `✅ Submission **${submissionId}** (${submission.emoji} ${submission.name}) has been cancelled.`
  };
}

module.exports = {
  loadSubmissions,
  saveSubmissions,
  submitCharacter,
  approveSubmission,
  rejectSubmission,
  getPendingSubmissions,
  getAllSubmissions,
  getSubmission,
  getUserSubmissions,
  formatSubmissionEmbed,
  formatPendingList,
  cancelSubmission
};
