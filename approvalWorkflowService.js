const { getCollection } = require('./mongoManager.js');
const { 
  getCustomCharacterById, 
  getCustomGame,
  getCustomGameByGameId,
  updateCustomGame 
} = require('./customGameService.js');

async function getPendingCharacters(limit = 25) {
  try {
    const collection = await getCollection('customCharacters');
    const pending = await collection
      .find({ approvalStatus: 'pending' })
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();
    
    return pending;
  } catch (error) {
    console.error('Error getting pending characters:', error);
    return [];
  }
}

async function getPendingCharactersForGame(gameId) {
  try {
    const collection = await getCollection('customCharacters');
    const pending = await collection
      .find({ gameId, approvalStatus: 'pending' })
      .sort({ createdAt: 1 })
      .toArray();
    
    return pending;
  } catch (error) {
    console.error('Error getting pending characters for game:', error);
    return [];
  }
}

async function approveCharacter(characterId, approvedBy) {
  try {
    const collection = await getCollection('customCharacters');
    
    const character = await collection.findOne({ characterId });
    if (!character) {
      return { success: false, message: '❌ Character not found!' };
    }
    
    if (character.approvalStatus === 'approved') {
      return { success: false, message: '❌ Character is already approved!' };
    }
    
    await collection.updateOne(
      { characterId },
      { 
        $set: { 
          approvalStatus: 'approved',
          approvedBy,
          approvedAt: Date.now()
        } 
      }
    );
    
    const gamesCollection = await getCollection('customGames');
    await gamesCollection.updateOne(
      { gameId: character.gameId },
      { $inc: { approvedCharacterCount: 1 } }
    );
    
    const game = await getCustomGameByGameId(character.gameId);
    
    return { 
      success: true, 
      message: `✅ Character "${character.name}" approved!\n\n🎮 **Game:** ${game?.gameName || 'Unknown'}\n👤 **Created by:** <@${character.createdBy}>\n✅ **Approved by:** <@${approvedBy}>`,
      character,
      game
    };
  } catch (error) {
    console.error('Error approving character:', error);
    return { success: false, message: '❌ Failed to approve character!' };
  }
}

async function rejectCharacter(characterId, rejectedBy, reason) {
  try {
    const collection = await getCollection('customCharacters');
    
    const character = await collection.findOne({ characterId });
    if (!character) {
      return { success: false, message: '❌ Character not found!' };
    }
    
    if (character.approvalStatus === 'approved') {
      return { success: false, message: '❌ Cannot reject an already approved character!' };
    }
    
    await collection.updateOne(
      { characterId },
      { 
        $set: { 
          approvalStatus: 'rejected',
          rejectedBy,
          rejectedAt: Date.now(),
          rejectionReason: reason
        } 
      }
    );
    
    const game = await getCustomGameByGameId(character.gameId);
    
    return { 
      success: true, 
      message: `❌ Character "${character.name}" rejected.\n\n🎮 **Game:** ${game?.gameName || 'Unknown'}\n👤 **Created by:** <@${character.createdBy}>\n📝 **Reason:** ${reason}`,
      character,
      game
    };
  } catch (error) {
    console.error('Error rejecting character:', error);
    return { success: false, message: '❌ Failed to reject character!' };
  }
}

async function getApprovalStats() {
  try {
    const collection = await getCollection('customCharacters');
    
    const pending = await collection.countDocuments({ approvalStatus: 'pending' });
    const approved = await collection.countDocuments({ approvalStatus: 'approved' });
    const rejected = await collection.countDocuments({ approvalStatus: 'rejected' });
    
    return { pending, approved, rejected, total: pending + approved + rejected };
  } catch (error) {
    console.error('Error getting approval stats:', error);
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }
}

async function getCharacterApprovalHistory(characterId) {
  try {
    const collection = await getCollection('customCharacters');
    const character = await collection.findOne({ characterId });
    
    if (!character) {
      return null;
    }
    
    return {
      characterId: character.characterId,
      name: character.name,
      gameId: character.gameId,
      createdBy: character.createdBy,
      createdAt: character.createdAt,
      approvalStatus: character.approvalStatus,
      approvedBy: character.approvedBy,
      approvedAt: character.approvedAt,
      rejectedBy: character.rejectedBy,
      rejectedAt: character.rejectedAt,
      rejectionReason: character.rejectionReason
    };
  } catch (error) {
    console.error('Error getting character approval history:', error);
    return null;
  }
}

async function resubmitCharacter(characterId, resubmittedBy) {
  try {
    const collection = await getCollection('customCharacters');
    
    const character = await collection.findOne({ characterId });
    if (!character) {
      return { success: false, message: '❌ Character not found!' };
    }
    
    if (character.approvalStatus !== 'rejected') {
      return { success: false, message: '❌ Only rejected characters can be resubmitted!' };
    }
    
    if (character.createdBy !== resubmittedBy) {
      return { success: false, message: '❌ Only the character creator can resubmit!' };
    }
    
    await collection.updateOne(
      { characterId },
      { 
        $set: { 
          approvalStatus: 'pending',
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          resubmittedAt: Date.now()
        } 
      }
    );
    
    return { 
      success: true, 
      message: `✅ Character "${character.name}" resubmitted for approval!`
    };
  } catch (error) {
    console.error('Error resubmitting character:', error);
    return { success: false, message: '❌ Failed to resubmit character!' };
  }
}

async function updateCharacterBeforeResubmit(characterId, updates, updatedBy) {
  try {
    const collection = await getCollection('customCharacters');
    
    const character = await collection.findOne({ characterId });
    if (!character) {
      return { success: false, message: '❌ Character not found!' };
    }
    
    if (character.approvalStatus === 'approved') {
      return { success: false, message: '❌ Cannot modify an approved character!' };
    }
    
    if (character.createdBy !== updatedBy) {
      return { success: false, message: '❌ Only the character creator can modify it!' };
    }
    
    const allowedUpdates = {};
    if (updates.name) allowedUpdates.name = updates.name;
    if (updates.emoji) allowedUpdates.emoji = updates.emoji;
    if (updates.description) allowedUpdates.description = updates.description;
    if (updates.imageUrl) allowedUpdates.imageUrl = updates.imageUrl;
    if (updates.uniqueMoveName && updates.uniqueMoveDamage) {
      allowedUpdates.uniqueMove = {
        name: updates.uniqueMoveName,
        damage: updates.uniqueMoveDamage
      };
    }
    
    await collection.updateOne(
      { characterId },
      { $set: allowedUpdates }
    );
    
    return { 
      success: true, 
      message: `✅ Character "${character.name}" updated!`
    };
  } catch (error) {
    console.error('Error updating character:', error);
    return { success: false, message: '❌ Failed to update character!' };
  }
}

function formatPendingCharacterEmbed(character, game) {
  const createdDate = new Date(character.createdAt).toLocaleString();
  
  return {
    title: `📋 ${character.name}`,
    description: character.description || 'No description provided.',
    fields: [
      { name: '🎮 Game', value: game?.gameName || 'Unknown', inline: true },
      { name: '👤 Creator', value: `<@${character.createdBy}>`, inline: true },
      { name: '📅 Created', value: createdDate, inline: true },
      { name: '😀 Emoji', value: character.emoji, inline: true },
      { name: '⚔️ Unique Move', value: `${character.uniqueMove.name} (${character.uniqueMove.damage} DMG)`, inline: true },
      { name: '🆔 Character ID', value: `\`${character.characterId}\``, inline: false }
    ],
    thumbnail: character.imageUrl ? { url: character.imageUrl } : null,
    color: 0xFFAA00
  };
}

function formatApprovedCharacterEmbed(character, game) {
  const approvedDate = character.approvedAt ? new Date(character.approvedAt).toLocaleString() : 'Unknown';
  
  return {
    title: `✅ ${character.name}`,
    description: character.description || 'No description provided.',
    fields: [
      { name: '🎮 Game', value: game?.gameName || 'Unknown', inline: true },
      { name: '👤 Creator', value: `<@${character.createdBy}>`, inline: true },
      { name: '✅ Approved By', value: `<@${character.approvedBy}>`, inline: true },
      { name: '📅 Approved', value: approvedDate, inline: true },
      { name: '😀 Emoji', value: character.emoji, inline: true },
      { name: '⚔️ Unique Move', value: `${character.uniqueMove.name} (${character.uniqueMove.damage} DMG)`, inline: true },
      { name: '📦 Obtainable', value: character.obtainable, inline: true }
    ],
    thumbnail: character.imageUrl ? { url: character.imageUrl } : null,
    color: 0x00FF00
  };
}

module.exports = {
  getPendingCharacters,
  getPendingCharactersForGame,
  approveCharacter,
  rejectCharacter,
  getApprovalStats,
  getCharacterApprovalHistory,
  resubmitCharacter,
  updateCharacterBeforeResubmit,
  formatPendingCharacterEmbed,
  formatApprovedCharacterEmbed
};
