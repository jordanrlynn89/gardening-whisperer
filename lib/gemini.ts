import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, GeminiResponse } from '@/types/chat';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Parse Gemini's JSON response with robust fallback strategies
 */
function parseGeminiResponse(text: string): GeminiResponse {
  // Step 1: Clean the response
  let jsonText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Step 2: Try direct parse
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed.structured && parsed.spokenResponse) {
      return parsed as GeminiResponse;
    }
  } catch {
    // Continue to fallbacks
  }

  // Step 3: Extract JSON object from mixed content
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.structured && parsed.spokenResponse) {
        return parsed as GeminiResponse;
      }
    } catch {
      // Step 4: Fix common JSON issues
      try {
        const fixed = jsonMatch[0]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/'/g, '"');
        const parsed = JSON.parse(fixed);
        if (parsed.structured && parsed.spokenResponse) {
          return parsed as GeminiResponse;
        }
      } catch {
        // All attempts failed
      }
    }
  }

  throw new Error(`Failed to parse JSON. Raw: ${text.slice(0, 200)}`);
}

/**
 * Call Gemini API with fast retry logic for transient failures
 */
async function callGeminiWithRetry(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  content: string | (string | { inlineData: { data: string; mimeType: string } })[],
  maxRetries = 2 // Reduced retries for speed
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(content);
      return result.response.text();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message || '';

      // Check if error is retryable (503, overloaded, timeout)
      const isRetryable =
        errorMessage.includes('503') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNRESET');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Faster retry: 100ms, 200ms (reduced for lower latency)
      const delay = 100 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Cached instant greeting (no API call needed)
const INSTANT_RESPONSES: Record<string, GeminiResponse> = {
  'hello, i need help with my plant': {
    structured: {
      nextAction: {
        type: 'ask_question',
        category: 'plant_id',
      },
      coverage: {
        plantIdentified: false,
        symptomsDiscussed: false,
        environmentAssessed: false,
        careHistoryGathered: false,
      },
    },
    spokenResponse: "Hi! What kind of plant is it?",
  },
};

// System prompt - gardening assistant with JSON responses
const SYSTEM_PROMPT = `Gardening assistant. Respond ONLY with valid JSON, nothing else.

{"structured":{"nextAction":{"type":"ask_question","category":"plant_id"},"coverage":{"plantIdentified":false,"symptomsDiscussed":false,"environmentAssessed":false,"careHistoryGathered":false}},"spokenResponse":"Short response here"}

Rules:
- spokenResponse: MAX 20 words
- type: ask_question, provide_diagnosis, or wrap_up
- category: plant_id, symptoms, environment, or care_history
- Set coverage to true when learned
- When all coverage true: add "diagnosis":{"condition":"...","confidence":"likely"} and "actions":{"doToday":["..."],"ifWorsens":["..."]}`;

export async function sendToGemini(
  userMessage: string,
  conversationHistory: ChatMessage[],
  imageData?: string
): Promise<GeminiResponse> {
  // Check cache for instant response (no API call = zero latency)
  const cacheKey = userMessage.toLowerCase().trim();
  if (!imageData && conversationHistory.length === 0 && INSTANT_RESPONSES[cacheKey]) {
    return INSTANT_RESPONSES[cacheKey];
  }

  // Use Gemini 3 Flash Preview (required for hackathon)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048, // Ensure full response completion
    },
  });

  // Build conversation context - keep last 6 messages for better context
  const recentHistory = conversationHistory.slice(-6);
  const context = recentHistory.length > 0
    ? recentHistory.map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')
    : '';

  // Debug: log conversation history
  console.log('[Gemini] History length:', conversationHistory.length);
  console.log('[Gemini] Recent history:', recentHistory.length);

  // Construct the prompt
  const prompt = context
    ? `${SYSTEM_PROMPT}\n\nCONVERSATION SO FAR:\n${context}\n\nUser: ${userMessage}\n\nRespond with JSON:`
    : `${SYSTEM_PROMPT}\n\nUser: ${userMessage}\n\nRespond with JSON:`;

  try {
    let text: string;

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

      text = await callGeminiWithRetry(model, [prompt, ...imageParts]);
    } else {
      // Text-only request
      text = await callGeminiWithRetry(model, prompt);
    }

    // Parse with robust fallback strategies
    const parsed = parseGeminiResponse(text);

    return parsed;
  } catch (error) {
    console.error('[Gemini] API error:', error);

    // Fast fallback - ask user to repeat
    return {
      structured: {
        nextAction: {
          type: 'ask_question' as const,
          question: 'Could you repeat that?',
          category: 'plant_id' as const,
        },
        coverage: {
          plantIdentified: false,
          symptomsDiscussed: false,
          environmentAssessed: false,
          careHistoryGathered: false,
        },
      },
      spokenResponse: "Sorry, I missed that. Could you repeat?",
    };
  }
}
