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

// Process text message
router.post('/process-text', authenticateUser, async (req, res) => {
  try {
    const { message, conversationId, context } = req.body
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    let conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId)
      if (!conversation || conversation.userId.toString() !== req.user._id.toString()) {
        return res.status(404).json({ error: 'Conversation not found' })
      }
    } else {
      // Create new conversation
      conversation = new Conversation({
        userId: req.user._id,
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        aiModel: req.user.preferences.aiModel || 'local'
      })
    }

    // Add user message
    conversation.addMessage({
      type: 'user',
      content: message,
      contentType: 'text',
      metadata: {
        language: req.user.preferences.language || 'en',
        timestamp: new Date()
      }
    })

    // Process with AI (offline/local processing)
    const aiResponse = await processWithLocalAI(message, context || conversation.getContextMessages())
    
    // Add AI response
    conversation.addMessage({
      type: 'ai',
      content: aiResponse,
      contentType: 'text',
      metadata: {
        language: req.user.preferences.language || 'en',
        timestamp: new Date()
      }
    })

    // Update user stats
    req.user.updateStats('message', 2) // user + ai message

    res.json({
      success: true,
      conversation: conversation,
      response: aiResponse,
      message: 'Message processed successfully'
    })

  } catch (error) {
    console.error('Error processing text:', error)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// Process voice message
router.post('/process-voice', authenticateUser, async (req, res) => {
  try {
    const { audioData, conversationId, duration } = req.body
    
    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' })
    }

    // Convert audio to text (simulated for now)
    const transcribedText = await transcribeAudio(audioData)
    
    if (!transcribedText) {
      return res.status(400).json({ error: 'Could not transcribe audio' })
    }

    let conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId)
      if (!conversation || conversation.userId.toString() !== req.user._id.toString()) {
        return res.status(404).json({ error: 'Conversation not found' })
      }
    } else {
      conversation = new Conversation({
        userId: req.user._id,
        title: transcribedText.substring(0, 50) + (transcribedText.length > 50 ? '...' : ''),
        aiModel: req.user.preferences.aiModel || 'local'
      })
    }

    // Add user voice message
    conversation.addMessage({
      type: 'user',
      content: transcribedText,
      contentType: 'voice',
      metadata: {
        voiceDuration: duration || 0,
        language: req.user.preferences.language || 'en',
        confidence: 0.95, // simulated confidence
        timestamp: new Date()
      }
    })

    // Process with AI
    const aiResponse = await processWithLocalAI(transcribedText, conversation.getContextMessages())
    
    // Add AI response
    conversation.addMessage({
      type: 'ai',
      content: aiResponse,
      contentType: 'text',
      metadata: {
        language: req.user.preferences.language || 'en',
        timestamp: new Date()
      }
    })

    // Update user stats
    req.user.updateStats('message', 2)
    req.user.updateStats('voice', 1)

    res.json({
      success: true,
      conversation: conversation,
      transcribedText,
      response: aiResponse,
      message: 'Voice message processed successfully'
    })

  } catch (error) {
    console.error('Error processing voice:', error)
    res.status(500).json({ error: 'Failed to process voice message' })
  }
})

// Get AI model status
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const modelStatus = {
      model: req.user.preferences.aiModel || 'local',
      status: 'active',
      offline: req.user.preferences.offlineMode || true,
      lastUpdated: new Date(),
      capabilities: {
        textProcessing: true,
        voiceProcessing: true,
        imageProcessing: false,
        fileProcessing: false
      },
      performance: {
        responseTime: '0.5s',
        accuracy: '95%',
        memoryUsage: '45%'
      }
    }

    res.json({
      success: true,
      status: modelStatus
    })

  } catch (error) {
    console.error('Error getting AI status:', error)
    res.status(500).json({ error: 'Failed to get AI status' })
  }
})

// Update AI preferences
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const { aiModel, offlineMode, voiceEnabled, voiceSpeed, voiceVolume, language } = req.body

    const updates = {}
    if (aiModel) updates['preferences.aiModel'] = aiModel
    if (offlineMode !== undefined) updates['preferences.offlineMode'] = offlineMode
    if (voiceEnabled !== undefined) updates['preferences.voiceEnabled'] = voiceEnabled
    if (voiceSpeed) updates['preferences.voiceSpeed'] = voiceSpeed
    if (voiceVolume) updates['preferences.voiceVolume'] = voiceVolume
    if (language) updates['preferences.language'] = language

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    )

    res.json({
      success: true,
      user: user.getPublicProfile(),
      message: 'Preferences updated successfully'
    })

  } catch (error) {
    console.error('Error updating preferences:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// Local AI processing function (simulated)
async function processWithLocalAI(message, context = []) {
  // This is a simplified local AI processing
  // In a real implementation, you would use TensorFlow.js or similar
  
  const responses = [
    `I understand you said: "${message}". I'm your personal AI assistant and I'm here to help you with various tasks. What would you like me to do?`,
    `That's an interesting point about "${message}". Let me think about that and provide you with a helpful response.`,
    `I've processed your message: "${message}". As your AI assistant, I can help you with information, tasks, and engaging conversations.`,
    `Thank you for sharing that with me. Regarding "${message}", I'm here to assist you in any way I can.`,
    `I've received your message and I'm processing it. "${message}" - let me provide you with a thoughtful response.`
  ]

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

  // Return a random response (in real implementation, this would be AI-generated)
  return responses[Math.floor(Math.random() * responses.length)]
}

// Audio transcription function (simulated)
async function transcribeAudio(audioData) {
  // This is a simplified transcription
  // In a real implementation, you would use Web Speech API or a local speech recognition model
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

  // Return a simulated transcription
  const sampleTranscriptions = [
    "Hello, how are you today?",
    "Can you help me with a question?",
    "What's the weather like?",
    "Tell me a joke",
    "I need some assistance"
  ]

  return sampleTranscriptions[Math.floor(Math.random() * sampleTranscriptions.length)]
}

module.exports = router 