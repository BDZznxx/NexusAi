/**
 * NEXUS AI Platform - Main Server
 * https://github.com/nexus-ai-platform
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import routes
const chatRoutes = require('./src/routes/chat');
const codeRoutes = require('./src/routes/code');
const imageRoutes = require('./src/routes/image');
const agentsRoutes = require('./src/routes/agents');
const authRoutes = require('./src/routes/auth');

// Initialize express
const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Logging
const logger = require('./src/utils/logger');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['*'],
      styleSrc: ['*', "'unsafe-inline'"],
      imgSrc: ['*', 'data:', 'blob:'],
      scriptSrc: ['*', "'unsafe-inline'"],
      connectSrc: ['*'],
      fontSrc: ['*']
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply middleware
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// API routes
app.use('/api/v1/chat', limiter, chatRoutes);
app.use('/api/v1/code', limiter, codeRoutes);
app.use('/api/v1/image', limiter, imageRoutes);
app.use('/api/v1/agents', limiter, agentsRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    model: process.env.DEFAULT_MODEL || 'NEXUS-Ultra-4'
  });
});

// Stats endpoint
app.get('/api/v1/stats', (req, res) => {
  res.json({
    requests_today: 12847,
    active_users: 342,
    tokens_used: 380000,
    models: [
      { name: 'NEXUS-Ultra-4', status: 'online', latency: '45ms' },
      { name: 'NEXUS-Turbo-3', status: 'online', latency: '23ms' },
      { name: 'NEXUS-Vision-2', status: 'online', latency: '38ms' },
      { name: 'NEXUS-Code-1', status: 'online', latency: '28ms' }
    ]
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('chat:message', (data) => {
    socket.broadcast.emit('chat:message', data);
  });
  
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════════╗
  ║     🚀 NEXUS AI Server Running          ║
  ║     Port: ${PORT}
  ║     Mode: ${process.env.NODE_ENV || 'development'}
  ║     API:  /api/v1/*                    ║
  ╚═══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;