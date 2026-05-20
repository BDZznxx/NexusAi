/**
 * NEXUS AI - Chat API Routes
 * Handles all chat-related endpoints
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// In-memory storage (replace with database in production)
const chatSessions = new Map();
const messageQueue = [];

// Initialize chat session
router.post('/init', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { userId, model, mode } = req.body;
    
    chatSessions.set(sessionId, {
      id: sessionId,
      userId: userId || 'anonymous',
      model: model || 'NEXUS-Ultra-4',
      mode: mode || 'chat',
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivity: Date.now()
    });

    res.json({
      success: true,
      sessionId,
      message: 'Chat session initialized'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message, mode, context } = req.body;
    
    // Get or create session
    let session = chatSessions.get(sessionId);
    if (!session) {
      sessionId = uuidv4();
      session = {
        id: sessionId,
        messages: [],
        createdAt: new Date().toISOString()
      };
      chatSessions.set(sessionId, session);
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    // Generate AI response (simulated - replace with actual AI call)
    const response = await generateAIResponse(message, mode, session.messages);

    // Add AI response
    session.messages.push({
      role: 'assistant',
      content: response.message,
      timestamp: Date.now()
    });

    session.lastActivity = Date.now();

    res.json({
      success: true,
      sessionId,
      message: response.message,
      mode: response.mode,
      tokens: response.tokens,
      latency: response.latency
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stream response (SSE)
router.post('/stream', async (req, res) => {
  const { sessionId, message, mode } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const words = message.split(' ');
    let responseText = '';

    // Simulate streaming response
    for (const word of words) {
      responseText += word + ' ';
      res.write(`data: ${JSON.stringify({ token: word, text: responseText })}\n\n`);
      await sleep(50);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Get chat history
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = chatSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      messages: session.messages,
      createdAt: session.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    chatSessions.delete(sessionId);

    res.json({
      success: true,
      message: 'Session deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function generateAIResponse(message, mode, history) {
  const startTime = Date.now();
  
  // Simulated responses based on mode
  const responses = {
    chat: `Saya mengerti pesan Anda: "${message}". Sebagai NEXUS AI, saya siap membantu Anda dengan berbagai tugas termasuk coding, analisis, riset, dan lainnya. Apa yang ingin Anda lakukan selanjutnya?`,
    
    code: `// Berikut implementasi untuk permintaan Anda:\n\nconst ${message.replace(/\s+/g, '_').toLowerCase()} = () => {\n  // Implementation\n  return true;\n};\n\nexport default ${message.replace(/\s+/g, '_').toLowerCase()};`,
    
    research: `Berdasarkan riset mendalam, berikut analisis komprehensif untuk "${message}":\n\n1. Ringkasan\n2. Sumber Terpercaya\n3. Analisis Mendalam\n4. Kesimpulan`,
    
    analyze: `Analisis untuk "${message}":\n\n• Kelebihan: [data]\n• Kekurangan: [data]\n• Rekomendasi: [action]`
  };

  const responseMode = mode || 'chat';
  const responseText = responses[responseMode] || responses.chat;

  return {
    message: responseText,
    mode: responseMode,
    tokens: Math.floor(message.length / 4),
    latency: Date.now() - startTime
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;