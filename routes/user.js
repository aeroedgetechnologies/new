const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const User = require('../models/User')

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    })

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    })

    await user.save()

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.status(201).json({
      success: true,
      user: user.getPublicProfile(),
      token,
      message: 'User registered successfully'
    })

  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Failed to register user' })
  }
})

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user by credentials
    const user = await User.findByCredentials(email, password)
    
    // Update last active
    user.updateLastActive()

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      user: user.getPublicProfile(),
      token,
      message: 'Login successful'
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      success: true,
      user: user.getPublicProfile()
    })

  } catch (error) {
    console.error('Profile error:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
})

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { username, email, avatar } = req.body
    const updates = {}

    if (username && username !== user.username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ username })
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' })
      }
      updates.username = username
    }

    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({ error: 'Email already taken' })
      }
      updates.email = email
    }

    if (avatar) {
      updates.avatar = avatar
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { new: true }
    )

    res.json({
      success: true,
      user: updatedUser.getPublicProfile(),
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('Profile update error:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Update user preferences
router.put('/preferences', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const {
      theme,
      voiceEnabled,
      voiceSpeed,
      voiceVolume,
      aiModel,
      offlineMode,
      language
    } = req.body

    const updates = {}
    if (theme) updates['preferences.theme'] = theme
    if (voiceEnabled !== undefined) updates['preferences.voiceEnabled'] = voiceEnabled
    if (voiceSpeed) updates['preferences.voiceSpeed'] = voiceSpeed
    if (voiceVolume) updates['preferences.voiceVolume'] = voiceVolume
    if (aiModel) updates['preferences.aiModel'] = aiModel
    if (offlineMode !== undefined) updates['preferences.offlineMode'] = offlineMode
    if (language) updates['preferences.language'] = language

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { new: true }
    )

    res.json({
      success: true,
      user: updatedUser.getPublicProfile(),
      message: 'Preferences updated successfully'
    })

  } catch (error) {
    console.error('Preferences update error:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// Get user stats
router.get('/stats', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      success: true,
      stats: user.stats,
      message: 'Stats retrieved successfully'
    })

  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ error: 'Failed to get stats' })
  }
})

// Delete user account
router.delete('/account', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Soft delete - mark as inactive
    user.isActive = false
    await user.save()

    res.json({
      success: true,
      message: 'Account deleted successfully'
    })

  } catch (error) {
    console.error('Account deletion error:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

// Change password
router.put('/password', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.json({
      success: true,
      message: 'Password changed successfully'
    })

  } catch (error) {
    console.error('Password change error:', error)
    res.status(500).json({ error: 'Failed to change password' })
  }
})

module.exports = router 