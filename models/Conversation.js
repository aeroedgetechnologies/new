const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['user', 'ai'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  contentType: {
    type: String,
    enum: ['text', 'voice', 'image', 'file'],
    default: 'text'
  },
  metadata: {
    voiceDuration: Number, // in seconds
    language: String,
    confidence: Number, // for voice recognition
    emotions: [String], // detected emotions
    intent: String, // detected intent
    entities: [{
      type: String,
      value: String,
      confidence: Number
    }]
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
})

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  messages: [messageSchema],
  summary: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  aiModel: {
    type: String,
    enum: ['local', 'hybrid', 'cloud'],
    default: 'local'
  },
  settings: {
    voiceEnabled: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'en'
    },
    contextWindow: {
      type: Number,
      default: 10 // number of messages to keep in context
    }
  },
  stats: {
    totalMessages: {
      type: Number,
      default: 0
    },
    userMessages: {
      type: Number,
      default: 0
    },
    aiMessages: {
      type: Number,
      default: 0
    },
    voiceMessages: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0 // in seconds
    },
    tokensUsed: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Indexes
conversationSchema.index({ userId: 1, createdAt: -1 })
conversationSchema.index({ userId: 1, status: 1 })
conversationSchema.index({ userId: 1, isFavorite: 1 })
conversationSchema.index({ lastMessageAt: -1 })

// Pre-save middleware to update stats
conversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.stats.totalMessages = this.messages.length
    this.stats.userMessages = this.messages.filter(m => m.type === 'user').length
    this.stats.aiMessages = this.messages.filter(m => m.type === 'ai').length
    this.stats.voiceMessages = this.messages.filter(m => m.contentType === 'voice').length
    
    // Update last message timestamp
    if (this.messages.length > 0) {
      this.lastMessageAt = this.messages[this.messages.length - 1].timestamp
    }
  }
  next()
})

// Method to add message
conversationSchema.methods.addMessage = function(messageData) {
  this.messages.push(messageData)
  this.lastMessageAt = new Date()
  return this.save()
}

// Method to get recent messages for context
conversationSchema.methods.getContextMessages = function(limit = 10) {
  return this.messages.slice(-limit)
}

// Method to generate title from first few messages
conversationSchema.methods.generateTitle = function() {
  const firstUserMessage = this.messages.find(m => m.type === 'user')
  if (firstUserMessage) {
    const content = firstUserMessage.content
    return content.length > 50 ? content.substring(0, 50) + '...' : content
  }
  return 'New Conversation'
}

// Method to calculate conversation duration
conversationSchema.methods.calculateDuration = function() {
  if (this.messages.length < 2) return 0
  
  const firstMessage = this.messages[0]
  const lastMessage = this.messages[this.messages.length - 1]
  
  return (lastMessage.timestamp - firstMessage.timestamp) / 1000 // in seconds
}

// Method to archive conversation
conversationSchema.methods.archive = function() {
  this.status = 'archived'
  return this.save()
}

// Method to delete conversation (soft delete)
conversationSchema.methods.delete = function() {
  this.status = 'deleted'
  return this.save()
}

// Method to restore conversation
conversationSchema.methods.restore = function() {
  this.status = 'active'
  return this.save()
}

// Method to toggle favorite
conversationSchema.methods.toggleFavorite = function() {
  this.isFavorite = !this.isFavorite
  return this.save()
}

// Static method to get user conversations
conversationSchema.statics.getUserConversations = function(userId, options = {}) {
  const {
    status = 'active',
    limit = 20,
    skip = 0,
    sortBy = 'lastMessageAt',
    sortOrder = 'desc'
  } = options

  const query = { userId, status }
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }

  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username avatar')
}

// Static method to search conversations
conversationSchema.statics.searchConversations = function(userId, searchTerm, options = {}) {
  const {
    limit = 20,
    skip = 0
  } = options

  const query = {
    userId,
    status: 'active',
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { 'messages.content': { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  }

  return this.find(query)
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username avatar')
}

module.exports = mongoose.model('Conversation', conversationSchema) 