const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: null
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'dark'
    },
    voiceEnabled: {
      type: Boolean,
      default: true
    },
    voiceSpeed: {
      type: Number,
      default: 1.0,
      min: 0.5,
      max: 2.0
    },
    voiceVolume: {
      type: Number,
      default: 0.8,
      min: 0,
      max: 1
    },
    aiModel: {
      type: String,
      enum: ['local', 'hybrid', 'cloud'],
      default: 'local'
    },
    offlineMode: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  stats: {
    conversations: {
      type: Number,
      default: 0
    },
    messages: {
      type: Number,
      default: 0
    },
    voiceInteractions: {
      type: Number,
      default: 0
    },
    totalUsageTime: {
      type: Number,
      default: 0 // in minutes
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Indexes
userSchema.index({ email: 1 })
userSchema.index({ username: 1 })
userSchema.index({ createdAt: -1 })

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  
  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject()
  delete userObject.password
  return userObject
}

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email })
  if (!user) {
    throw new Error('Invalid login credentials')
  }
  
  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    throw new Error('Invalid login credentials')
  }
  
  return user
}

// Update last active timestamp
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date()
  return this.save()
}

// Update user stats
userSchema.methods.updateStats = function(type, increment = 1) {
  switch (type) {
    case 'conversation':
      this.stats.conversations += increment
      break
    case 'message':
      this.stats.messages += increment
      break
    case 'voice':
      this.stats.voiceInteractions += increment
      break
    case 'usage':
      this.stats.totalUsageTime += increment
      break
  }
  return this.save()
}

module.exports = mongoose.model('User', userSchema) 