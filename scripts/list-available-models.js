const { GoogleGenerativeAI } = require('@google/generative-ai');

// Read API key from command line argument or env
const apiKey = process.argv[2] || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Please provide API key as argument: node list-available-models.js YOUR_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    console.log('Fetching available models...\n');

    const models = await genAI.listModels();

    console.log('Available models that support generateContent:\n');

    for (const model of models) {
      // Only show models that support generateContent
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(`✅ ${model.name.replace('models/', '')}`);
        console.log(`   Display: ${model.displayName}`);
        console.log(`   Description: ${model.description}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

listModels();
