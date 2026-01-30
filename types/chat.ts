// Chat message types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Gemini two-layer response structure (per CLAUDE.md)
export interface GeminiResponse {
  // Layer 1: Structured JSON for app behavior
  structured: {
    // Diagnosis information
    diagnosis?: {
      condition: string; // e.g., "Nitrogen deficiency"
      confidence: 'likely' | 'possible' | 'unlikely'; // No percentages
      symptoms: string[]; // Observed symptoms
      reasoning: string; // Why this diagnosis
      alternatives: string[]; // Other possible causes
    };

    // Garden walk coverage tracking
    coverage?: {
      plantIdentified: boolean;
      symptomsDiscussed: boolean;
      environmentAssessed: boolean;
      careHistoryGathered: boolean;
    };

    // Next actions for the conversation
    nextAction?: {
      type: 'ask_question' | 'suggest_photo' | 'provide_diagnosis' | 'wrap_up';
      question?: string; // If asking a question
      category?: 'plant_id' | 'symptoms' | 'environment' | 'care_history';
    };

    // Action items for the user
    actions?: {
      doToday: string[];
      checkInDays?: number;
      ifWorsens: string[];
    };
  };

  // Layer 2: Natural language for TTS (sent to ElevenLabs)
  spokenResponse: string;
}

// API request/response types
export interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
  includeImage?: boolean;
  imageData?: string; // base64 encoded image
}

export interface ChatApiResponse {
  success: boolean;
  data?: GeminiResponse;
  error?: string;
}
