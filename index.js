const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const dotenv = require('dotenv')
const path = require('path')

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(helmet())
app.use(cors({ origin: '*', credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// MongoDB Connection with your provided connection string
const connectDB = async () => {
  try {
    const mongoURI = 'mongodb+srv://govindayadav2478:pNd0xeqR36qV7aml@cluster0.eljuffx.mongodb.net/akshara-ai?retryWrites=true&w=majority&appName=Cluster0'
    await mongoose.connect(mongoURI)
    console.log('✅ Connected to MongoDB Atlas')
  } catch (error) {
    console.log('❌ MongoDB connection failed, running in offline mode')
    console.log('💡 Error:', error.message)
  }
}

connectDB()

// Import routes
const aiRoutes = require('./routes/ai')
const userRoutes = require('./routes/user')
const conversationRoutes = require('./routes/conversation')

// Routes
app.use('/api/ai', aiRoutes)
app.use('/api/user', userRoutes)
app.use('/api/conversation', conversationRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Akshara AI Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../out')))
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../out/index.html'))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 Akshara AI Server running on port ${PORT}`)
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`)
  console.log(`🌐 Frontend: http://localhost:3000`)
}) 