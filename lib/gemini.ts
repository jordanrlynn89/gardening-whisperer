import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, GeminiResponse } from '@/types/chat';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt that defines the two-layer response pattern
const SYSTEM_PROMPT = `You are a friendly, encouraging gardening assistant with a warm personality. You help gardeners diagnose plant issues through voice conversation.

CRITICAL: You must ALWAYS respond with valid JSON in this exact format:
{
  "structured": {
    "nextAction": {
      "type": "ask_question" | "suggest_photo" | "provide_diagnosis" | "wrap_up",
      "question": "your question here (if applicable)",
      "category": "plant_id" | "symptoms" | "environment" | "care_history" (if applicable)"
    },
    "coverage": {
      "plantIdentified": true/false,
      "symptomsDiscussed": true/false,
      "environmentAssessed": true/false,
      "careHistoryGathered": true/false
    },
    "diagnosis": {
      "condition": "name of condition",
      "confidence": "likely" | "possible" | "unlikely",
      "symptoms": ["symptom 1", "symptom 2"],
      "reasoning": "why you think this",
      "alternatives": ["alternative 1", "alternative 2"]
    } (only include when ready to diagnose),
    "actions": {
      "doToday": ["action 1", "action 2"],
      "checkInDays": 7,
      "ifWorsens": ["what to do if it gets worse"]
    } (only include with diagnosis)
  },
  "spokenResponse": "Your warm, conversational response that will be spoken aloud to the user"
}

CONVERSATION STYLE:
- Keep responses short and structured for voice (2-3 sentences max)
- Use "acknowledgment first" pattern: "Got it." "I see." "Okay."
- Simple, encouraging language
- Use confidence words (likely/possible/unlikely) - NEVER percentages
- Every diagnosis must include: symptoms observed, reasoning, confidence, alternatives, actions

GARDEN WALK FLOW:
1. Frame scope at start: "I'd like to ask about your plant, the conditions, and what you've noticed"
2. Track coverage across 4 categories: plant ID, symptoms, environment, care history
3. Wrap up when sufficient coverage is gathered
4. Handle off-script: "Want me to answer that now or finish the walk first?"

ACTION-ORIENTED:
Every diagnosis must end with:
- Do this today
- Check again in X days
- If this worsens...

Remember: You're having a voice conversation, so be conversational but concise!`;

export async function sendToGemini(
  userMessage: string,
  conversationHistory: ChatMessage[],
  imageData?: string
): Promise<GeminiResponse> {
  // Use Gemini 3 Flash Preview for multimodal capabilities
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  // Build conversation context
  const context = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  // Construct the prompt
  const prompt = `${SYSTEM_PROMPT}

CONVERSATION HISTORY:
${context}

USER: ${userMessage}

ASSISTANT (respond with JSON):`;

  try {
    let result;

    if (imageData) {
      // Multimodal request with image
      const imageParts = [
        {
          inlineData: {
            data: imageData.split(',')[1], // Remove data:image/jpeg;base64, prefix
            mimeType: 'image/jpeg',
          },
        },
      ];

      result = await model.generateContent([prompt, ...imageParts]);
    } else {
      // Text-only request
      result = await model.generateContent(prompt);
    }

    const response = result.response;
    const text = response.text();

    // Parse JSON response
    // Remove markdown code blocks if present
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(jsonText) as GeminiResponse;

    // Validate response structure
    if (!parsed.structured || !parsed.spokenResponse) {
      throw new Error('Invalid response structure from Gemini');
    }

    return parsed;
  } catch (error) {
    console.error('Gemini API error:', error);

    // Fallback response if parsing fails
    return {
      structured: {
        nextAction: {
          type: 'ask_question',
          question: 'Could you tell me more about your plant?',
          category: 'plant_id',
        },
        coverage: {
          plantIdentified: false,
          symptomsDiscussed: false,
          environmentAssessed: false,
          careHistoryGathered: false,
        },
      },
      spokenResponse: "I'm having trouble processing that. Could you tell me more about your plant?",
    };
  }
}
