/**
 * NEXUS AI - Image API Routes
 * Handles image generation endpoints
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

// Image presets
const stylePresets = {
  photorealistic: { quality: 'high', detail: 'ultra' },
  cinematic: { lighting: ' dramatic', color: 'teal-orange' },
  anime: { style: 'anime', lines: 'clean' },
  'oil-painting': { texture: 'brushstrokes', blend: 'soft' },
  '3d-render': { engine: 'blender', samples: 128 },
  watercolor: { paper: 'cold-press', blending: 'wet' },
  sketch: { medium: 'graphite', pressure: 'varied' },
  'pixel-art': { pixelSize: 4, palette: '16-color' }
};

// Image gallery (in-memory)
const imageGallery = new Map();

// Generate images
router.post('/generate', async (req, res) => {
  try {
    const { prompt, negativePrompt, style, aspectRatio, steps, cfgScale, count } = req.body;
    const sessionId = uuidv4();
    
    const images = [];
    const colors = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#a18cd1', '#fbc2eb']
    ];

    const emojis = ['🌆', '🌸', '🤖', '🏔️', '🎭', '🌌', '🎆', '🦋'];
    
    for (let i = 0; i < (count || 4); i++) {
      const imageId = uuidv4();
      const colorIdx = Math.floor(Math.random() * colors.length);
      const emojiIdx = Math.floor(Math.random() * emojis.length);
      
      images.push({
        id: imageId,
        url: `/api/v1/image/download/${imageId}`,
        colors: colors[colorIdx],
        icon: emojis[emojiIdx],
        prompt,
        style: style || 'photorealistic',
        createdAt: new Date().toISOString()
      });

      // Store in gallery
      imageGallery.set(imageId, {
        id: imageId,
        prompt,
        style,
        colors: colors[colorIdx],
        createdAt: Date.now()
      });
    }

    res.json({
      success: true,
      sessionId,
      images,
      metadata: {
        prompt,
        style: stylePresets[style] || stylePresets.photorealistic,
        aspectRatio: aspectRatio || '16:9',
        steps: steps || 30,
        cfgScale: cfgScale || 7,
        count: images.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get image by ID
router.get('/image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = imageGallery.get(id);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Return placeholder image data
    res.json({
      success: true,
      image: {
        ...image,
        gradient: `linear-gradient(135deg, ${image.colors[0]}, ${image.colors[1]})`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download image
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = imageGallery.get(id);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Generate gradient image using sharp
    const gradientSvg = `
      <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${image.colors[0]};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${image.colors[1]};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="50%" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">
          NEXUS AI Image
        </text>
      </svg>
    `;

    const buffer = await sharp(Buffer.from(gradientSvg))
      .png()
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get gallery
router.get('/gallery', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const images = Array.from(imageGallery.values())
      .slice((page - 1) * limit, page * limit)
      .map(img => ({
        ...img,
        url: `/api/v1/image/download/${img.id}`
      }));

    res.json({
      success: true,
      images,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: imageGallery.size,
        pages: Math.ceil(imageGallery.size / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete image
router.delete('/image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    imageGallery.delete(id);

    res.json({
      success: true,
      message: 'Image deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Style presets
router.get('/presets', (req, res) => {
  res.json({
    success: true,
    presets: stylePresets,
    default: 'photorealistic'
  });
});

module.exports = router;