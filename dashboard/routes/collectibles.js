const express = require('express');
const { authMiddleware, superAdminMiddleware } = require('./auth.js');
const db = require('../database.js');
const { RARITY_TYPES } = require('../schemas.js');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rarity, search } = req.query;
    const filters = {};
    
    if (rarity) filters.rarity = rarity;
    if (search) filters.search = search;
    
    const collectibles = await db.getAllGlobalCollectibles(filters);
    
    res.json({
      success: true,
      collectibles: collectibles.map(c => ({
        id: c.id || (c._id ? c._id.toString() : c.name),
        name: c.name,
        description: c.description,
        emoji: c.emoji,
        imageUrl: c.imageUrl,
        rarity: c.rarity,
        bundle: c.bundle,
        isGlobal: c.isGlobal,
        droppable: c.droppable,
        crateObtainable: c.crateObtainable,
        tradable: c.tradable,
        giftable: c.giftable,
        sellable: c.sellable,
        baseValue: c.baseValue,
        stackable: c.stackable,
        createdAt: c.createdAt,
        createdBy: c.createdBy
      })),
      rarityTypes: RARITY_TYPES
    });
  } catch (error) {
    console.error('[Dashboard Collectibles] Error getting collectibles:', error);
    res.status(500).json({ success: false, error: 'Failed to get collectibles' });
  }
});

router.get('/:collectibleId', authMiddleware, async (req, res) => {
  const { collectibleId } = req.params;
  
  try {
    const collectible = await db.getGlobalCollectibleById(collectibleId);
    
    if (!collectible) {
      return res.status(404).json({ success: false, error: 'Collectible not found' });
    }
    
    res.json({
      success: true,
      collectible: {
        id: collectible.id || (collectible._id ? collectible._id.toString() : collectible.name),
        name: collectible.name,
        description: collectible.description,
        emoji: collectible.emoji,
        imageUrl: collectible.imageUrl,
        rarity: collectible.rarity,
        bundle: collectible.bundle,
        isGlobal: collectible.isGlobal,
        droppable: collectible.droppable,
        crateObtainable: collectible.crateObtainable,
        tradable: collectible.tradable,
        giftable: collectible.giftable,
        sellable: collectible.sellable,
        baseValue: collectible.baseValue,
        stackable: collectible.stackable,
        createdAt: collectible.createdAt,
        createdBy: collectible.createdBy,
        approvedBy: collectible.approvedBy,
        approvedAt: collectible.approvedAt
      }
    });
  } catch (error) {
    console.error('[Dashboard Collectibles] Error getting collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to get collectible' });
  }
});

router.post('/', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { name, description, emoji, imageUrl, rarity, bundle, isGlobal, droppable, crateObtainable, tradable, giftable, sellable, baseValue, stackable } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  
  try {
    const result = await db.createGlobalCollectible({
      name,
      description,
      emoji: emoji || '🎁',
      imageUrl,
      rarity: rarity || 'common',
      bundle,
      isGlobal: isGlobal !== false,
      droppable: droppable || { enabled: false },
      crateObtainable: crateObtainable || { enabled: false },
      tradable: tradable !== false,
      giftable: giftable !== false,
      sellable: sellable !== false,
      baseValue: baseValue || 100,
      stackable: stackable !== false,
      createdBy: req.user.userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Collectibles] Error creating collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to create collectible' });
  }
});

router.put('/:collectibleId', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { collectibleId } = req.params;
  const updates = req.body;
  
  try {
    const result = await db.updateGlobalCollectible(collectibleId, updates);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Collectibles] Error updating collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to update collectible' });
  }
});

router.delete('/:collectibleId', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { collectibleId } = req.params;
  
  try {
    const result = await db.deleteGlobalCollectible(collectibleId);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Collectibles] Error deleting collectible:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collectible' });
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
    
    const submissions = await db.getCollectibleSubmissions(filters);
    
    res.json({
      success: true,
      submissions: submissions.map(s => ({
        id: s._id.toString(),
        name: s.name,
        description: s.description,
        emoji: s.emoji,
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
    console.error('[Dashboard Collectibles] Error getting submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to get submissions' });
  }
});

router.post('/submissions', authMiddleware, async (req, res) => {
  const { name, description, emoji, imageUrl, rarity, droppable, crateObtainable, tradable, giftable, sellable, baseValue, stackable } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  
  try {
    const result = await db.createCollectibleSubmission({
      name,
      description,
      emoji: emoji || '🎁',
      imageUrl,
      rarity: rarity || 'common',
      droppable,
      crateObtainable,
      tradable,
      giftable,
      sellable,
      baseValue,
      stackable,
      submittedBy: req.user.userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Collectibles] Error creating submission:', error);
    res.status(500).json({ success: false, error: 'Failed to create submission' });
  }
});

router.post('/submissions/:submissionId/approve', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { submissionId } = req.params;
  
  try {
    const result = await db.approveCollectibleSubmission(submissionId, req.user.userId);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Collectibles] Error approving submission:', error);
    res.status(500).json({ success: false, error: 'Failed to approve submission' });
  }
});

router.post('/submissions/:submissionId/reject', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { submissionId } = req.params;
  const { reason } = req.body;
  
  try {
    const result = await db.rejectCollectibleSubmission(submissionId, req.user.userId, reason);
    res.json(result);
  } catch (error) {
    console.error('[Dashboard Collectibles] Error rejecting submission:', error);
    res.status(500).json({ success: false, error: 'Failed to reject submission' });
  }
});

module.exports = { router };
