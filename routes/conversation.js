const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const Conversation = require('../models/Conversation')
const User = require('../models/User')

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Get all conversations for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      status = 'active', 
      limit = 20, 
      skip = 0, 
      sortBy = 'lastMessageAt',
      sortOrder = 'desc'
    } = req.query

    const conversations = await Conversation.getUserConversations(req.user._id, {
      status,
      limit: parseInt(limit),
      skip: parseInt(skip),
      sortBy,
      sortOrder
    })

    res.json({
      success: true,
      conversations,
      message: 'Conversations retrieved successfully'
    })

  } catch (error) {
    console.error('Get conversations error:', error)
    res.status(500).json({ error: 'Failed to get conversations' })
  }
})

// Get single conversation
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('userId', 'username avatar')

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json({
      success: true,
      conversation,
      message: 'Conversation retrieved successfully'
    })

  } catch (error) {
    console.error('Get conversation error:', error)
    res.status(500).json({ error: 'Failed to get conversation' })
  }
})

// Create new conversation
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { title, aiModel, settings } = req.body

    const conversation = new Conversation({
      userId: req.user._id,
      title: title || 'New Conversation',
      aiModel: aiModel || req.user.preferences.aiModel || 'local',
      settings: {
        voiceEnabled: req.user.preferences.voiceEnabled || true,
        language: req.user.preferences.language || 'en',
        contextWindow: 10,
        ...settings
      }
    })

    await conversation.save()

    // Update user stats
    req.user.updateStats('conversation', 1)

    res.status(201).json({
      success: true,
      conversation,
      message: 'Conversation created successfully'
    })

  } catch (error) {
    console.error('Create conversation error:', error)
    res.status(500).json({ error: 'Failed to create conversation' })
  }
})

// Update conversation
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { title, summary, tags, isFavorite } = req.body

    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const updates = {}
    if (title) updates.title = title
    if (summary) updates.summary = summary
    if (tags) updates.tags = tags
    if (isFavorite !== undefined) updates.isFavorite = isFavorite

    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).populate('userId', 'username avatar')

    res.json({
      success: true,
      conversation: updatedConversation,
      message: 'Conversation updated successfully'
    })

  } catch (error) {
    console.error('Update conversation error:', error)
    res.status(500).json({ error: 'Failed to update conversation' })
  }
})

// Archive conversation
router.put('/:id/archive', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await conversation.archive()

    res.json({
      success: true,
      message: 'Conversation archived successfully'
    })

  } catch (error) {
    console.error('Archive conversation error:', error)
    res.status(500).json({ error: 'Failed to archive conversation' })
  }
})

// Delete conversation (soft delete)
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await conversation.delete()

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    })

  } catch (error) {
    console.error('Delete conversation error:', error)
    res.status(500).json({ error: 'Failed to delete conversation' })
  }
})

// Restore conversation
router.put('/:id/restore', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await conversation.restore()

    res.json({
      success: true,
      message: 'Conversation restored successfully'
    })

  } catch (error) {
    console.error('Restore conversation error:', error)
    res.status(500).json({ error: 'Failed to restore conversation' })
  }
})

// Toggle favorite
router.put('/:id/favorite', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await conversation.toggleFavorite()

    res.json({
      success: true,
      isFavorite: conversation.isFavorite,
      message: `Conversation ${conversation.isFavorite ? 'added to' : 'removed from'} favorites`
    })

  } catch (error) {
    console.error('Toggle favorite error:', error)
    res.status(500).json({ error: 'Failed to toggle favorite' })
  }
})

// Search conversations
router.get('/search/:query', authenticateUser, async (req, res) => {
  try {
    const { query } = req.params
    const { limit = 20, skip = 0 } = req.query

    const conversations = await Conversation.searchConversations(
      req.user._id,
      query,
      {
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    )

    res.json({
      success: true,
      conversations,
      query,
      message: 'Search completed successfully'
    })

  } catch (error) {
    console.error('Search conversations error:', error)
    res.status(500).json({ error: 'Failed to search conversations' })
  }
})

// Get conversation stats
router.get('/:id/stats', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const stats = {
      totalMessages: conversation.stats.totalMessages,
      userMessages: conversation.stats.userMessages,
      aiMessages: conversation.stats.aiMessages,
      voiceMessages: conversation.stats.voiceMessages,
      duration: conversation.calculateDuration(),
      tokensUsed: conversation.stats.tokensUsed,
      averageResponseTime: '0.5s', // simulated
      messageTypes: {
        text: conversation.messages.filter(m => m.contentType === 'text').length,
        voice: conversation.messages.filter(m => m.contentType === 'voice').length,
        image: conversation.messages.filter(m => m.contentType === 'image').length,
        file: conversation.messages.filter(m => m.contentType === 'file').length
      }
    }

    res.json({
      success: true,
      stats,
      message: 'Stats retrieved successfully'
    })

  } catch (error) {
    console.error('Get conversation stats error:', error)
    res.status(500).json({ error: 'Failed to get conversation stats' })
  }
})

// Export conversation
router.get('/:id/export', authenticateUser, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('userId', 'username')

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const exportData = {
      conversation: {
        id: conversation._id,
        title: conversation.title,
        summary: conversation.summary,
        tags: conversation.tags,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        stats: conversation.stats
      },
      messages: conversation.messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        contentType: msg.contentType,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      })),
      exportDate: new Date().toISOString(),
      format: 'json'
    }

    res.json({
      success: true,
      exportData,
      message: 'Conversation exported successfully'
    })

  } catch (error) {
    console.error('Export conversation error:', error)
    res.status(500).json({ error: 'Failed to export conversation' })
  }
})

module.exports = router 