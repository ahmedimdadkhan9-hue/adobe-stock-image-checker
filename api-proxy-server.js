// api-proxy-server.js
// এটা আপনার backend proxy server - Vercel বা Railway এ চালাতে পারবেন
// npm install express cors dotenv
// তারপর: node api-proxy-server.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Adobe Stock AI Checker Proxy is running! ✅' });
});

// Analyze image endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64, provider = 'claude', apiKey } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 প্রয়োজন' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey প্রয়োজন' });
    }

    let response;

    if (provider === 'gemini') {
      // Gemini API call
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `আপনি Adobe Stock এর একজন বিশেষজ্ঞ reviewer। এই ইমেজটি বিশ্লেষণ করুন এবং কেবল JSON ফরম্যাট ফেরত দিন।

{
  "quality_score": 0-100 সংখ্যা,
  "uniqueness_score": 0-100 সংখ্যা,
  "adobe_stock_readiness": 0-100 সংখ্যা,
  "rejection_probability": 0-100 সংখ্যা,
  "quality_assessment": "বাংলায় সংক্ষিপ্ত মন্তব্য",
  "uniqueness_assessment": "বাংলায় সংক্ষিপ্ত মন্তব্য",
  "common_rejection_reasons": ["কারণ ১", "কারণ ২", "কারণ ৩"],
  "improvement_suggestions": ["সাজেশন ১", "সাজেশন ২", "সাজেশন ৩"],
  "positive_aspects": ["ইতিবাচক দিক ১", "ইতিবাচক দিক ২"]
}`,
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );
    } else {
      // Claude API call
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: imageBase64,
                  },
                },
                {
                  type: 'text',
                  text: `আপনি Adobe Stock এর একজন বিশেষজ্ঞ reviewer। এই ইমেজটি বিশ্লেষণ করুন এবং কেবল JSON ফরম্যাট ফেরত দিন।

{
  "quality_score": 0-100 সংখ্যা,
  "uniqueness_score": 0-100 সংখ্যা,
  "adobe_stock_readiness": 0-100 সংখ্যা,
  "rejection_probability": 0-100 সংখ্যা,
  "quality_assessment": "বাংলায় সংক্ষিপ্ত মন্তব্য",
  "uniqueness_assessment": "বাংলায় সংক্ষিপ্ত মন্তব্য",
  "common_rejection_reasons": ["কারণ ১", "কারণ ২", "কারণ ৩"],
  "improvement_suggestions": ["সাজেশন ১", "সাজেশন ২", "সাজেশন ৩"],
  "positive_aspects": ["ইতিবাচক দিক ১", "ইতিবাচক দিক ২"]
}`,
                },
              ],
            },
          ],
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API Error: ${response.status} - ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    let responseText = '';

    // Parse response based on provider
    if (provider === 'gemini') {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        responseText = data.candidates[0].content.parts
          .filter((part) => part.text)
          .map((part) => part.text)
          .join('');
      }
    } else {
      // Claude response
      if (data.content && data.content.length > 0) {
        responseText = data.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('');
      }
    }

    if (!responseText) {
      throw new Error('API থেকে খালি রেসপন্স পেয়েছি');
    }

    // JSON এক্সট্র্যাক্ট করুন
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON ফরম্যাট পাওয়া যায়নি');
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!analysisData.quality_score || !analysisData.uniqueness_score) {
      throw new Error('Invalid response format');
    }

    res.json(analysisData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message || 'এনালাইসিস ব্যর্থ হয়েছে',
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server চলছে http://localhost:${PORT}`);
});