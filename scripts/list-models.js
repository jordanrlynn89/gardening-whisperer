const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();
    console.log('\n📋 Available Gemini Models:\n');
    models.forEach((model) => {
      if (model.name.includes('generateContent')) {
        console.log(`✓ ${model.name}`);
      }
    });
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

listModels();
