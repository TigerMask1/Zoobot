const express = require('express');
const { authMiddleware, superAdminMiddleware } = require('./auth.js');
const db = require('../database.js');
const { RARITY_TYPES, OBTAINABLE_TYPES } = require('../schemas.js');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rarity, obtainable, search } = req.query;
    const filters = {};
    
    if (rarity) filters.rarity = rarity;
    if (obtainable) filters.obtainable = obtainable;
    if (search) filters.search = search;
    
    const characters = await db.getAllGlobalCharacters(filters);
    
    res.json({
      success: true,
      characters: characters.map(c => ({
        id: c._id.toString(),
        name: c.name,
        emoji: c.emoji,
        customEmojiId: c.customEmojiId,
        description: c.description,
        imageUrl: c.imageUrl,
        rarity: c.rarity,
        obtainable: c.obtainable,
        ability: c.ability,
        specialMove: c.specialMove,
        stats: c.stats,
        createdAt: c.createdAt,
        createdBy: c.createdBy
      })),
      rarityTypes: RARITY_TYPES,
      obtainableTypes: OBTAINABLE_TYPES
    });
  } catch (error) {
    console.error('[Dashboard Characters] Error getting characters:', error);
    res.status(500).json({ success: false, error: 'Failed to get characters' });
  }
});

router.get('/:characterId', authMiddleware, async (req, res) => {
  const { characterId } = req.params;
  
  try {
    const character = await db.getGlobalCharacterById(characterId);
    
    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }
    
    res.json({
      success: true,
      character: {
        id: character._id.toString(),
        name: character.name,
        emoji: character.emoji,
        customEmojiId: character.customEmojiId,
        description: character.description,
        imageUrl: character.imageUrl,
        rarity: character.rarity,
        obtainable: character.obtainable,
        ability: character.ability,
        specialMove: character.specialMove,
        stats: character.stats,
        createdAt: character.createdAt,
        createdBy: character.createdBy,
        approvedBy: character.approvedBy,
        approvedAt: character.approvedAt
      }
    });
  } catch (error) {
    console.error('[Dashboard Characters] Error getting character:', error);
    res.status(500).json({ success: false, error: 'Failed to get character' });
  }
});

router.post('/', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { name, emoji, customEmojiId, description, imageUrl, rarity, obtainable, ability, specialMove, stats } = req.body;
  
  if (!name || !emoji) {
    return res.status(400).json({ success: false, error: 'Name and emoji are required' });
  }
  
  try {
    const result = await db.createGlobalCharacter({
      name,
      emoji,
      customEmojiId,
      description,
      imageUrl,
      rarity: rarity || 'common',
      obtainable: obtainable || 'crate',
      ability,
      specialMove,
      stats,
      createdBy: req.user.userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Characters] Error creating character:', error);
    res.status(500).json({ success: false, error: 'Failed to create character' });
  }
});

router.put('/:characterId', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { characterId } = req.params;
  const updates = req.body;
  
  try {
    const result = await db.updateGlobalCharacter(characterId, updates);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Characters] Error updating character:', error);
    res.status(500).json({ success: false, error: 'Failed to update character' });
  }
});

router.delete('/:characterId', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { characterId } = req.params;
  
  try {
    const result = await db.deleteGlobalCharacter(characterId);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Characters] Error deleting character:', error);
    res.status(500).json({ success: false, error: 'Failed to delete character' });
  }
});

router.get('/submissions/list', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (!req.user.isSuperAdmin && !req.user.isGlobalAdmin) {
      filters.submittedBy = req.user.userId;
    }
    
    const submissions = await db.getCharacterSubmissions(filters);
    
    res.json({
      success: true,
      submissions: submissions.map(s => ({
        id: s._id.toString(),
        name: s.name,
        emoji: s.emoji,
        description: s.description,
        imageUrl: s.imageUrl,
        rarity: s.rarity,
        status: s.status,
        submittedBy: s.submittedBy,
        submittedByUsername: s.submittedByUsername,
        createdAt: s.createdAt,
        rejectionReason: s.rejectionReason
      }))
    });
  } catch (error) {
    console.error('[Dashboard Characters] Error getting submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to get submissions' });
  }
});

router.post('/submissions', authMiddleware, async (req, res) => {
  const { name, emoji, customEmojiId, description, imageUrl, rarity, ability, specialMove } = req.body;
  
  if (!name || !emoji) {
    return res.status(400).json({ success: false, error: 'Name and emoji are required' });
  }
  
  try {
    const result = await db.createCharacterSubmission({
      name,
      emoji,
      customEmojiId,
      description,
      imageUrl,
      rarity: rarity || 'common',
      ability,
      specialMove,
      submittedBy: req.user.userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Characters] Error creating submission:', error);
    res.status(500).json({ success: false, error: 'Failed to create submission' });
  }
});

router.post('/submissions/:submissionId/approve', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { submissionId } = req.params;
  
  try {
    const result = await db.approveCharacterSubmission(submissionId, req.user.userId);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Characters] Error approving submission:', error);
    res.status(500).json({ success: false, error: 'Failed to approve submission' });
  }
});

router.post('/submissions/:submissionId/reject', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { submissionId } = req.params;
  const { reason } = req.body;
  
  try {
    const result = await db.rejectCharacterSubmission(submissionId, req.user.userId, reason);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Characters] Error rejecting submission:', error);
    res.status(500).json({ success: false, error: 'Failed to reject submission' });
  }
});

module.exports = { router };
