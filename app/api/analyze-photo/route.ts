import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const PHOTO_ANALYSIS_PROMPT = `You are a plant diagnosis assistant. Describe ONLY what you can directly observe in this photo — nothing more.

Rules:
- Only state facts you can actually see in the image. Do NOT guess, infer, or speculate about anything not clearly visible.
- If you cannot identify the plant species with confidence, say so explicitly: "I can't identify the exact species from this photo."
- If the image is blurry, too dark, or the plant is partially visible, say so. Do not describe details you cannot see.
- Do NOT reference the conversation history to fill in gaps — only describe what the photo shows.

Describe in 3-5 sentences: what plant you see (or that you can't tell), its visible health, and any clearly visible issues. This will be read aloud.`;

export async function POST(request: NextRequest) {
  try {
    const { imageData, conversationContext } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
        { status: 400 }
      );
    }

    // 10 MB max (base64 is ~33% larger than raw, so ~7.5 MB actual image)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    if (imageData.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image too large (max 10 MB)' },
        { status: 413 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Strip data URL prefix if present
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;

    // Build prompt with conversation context
    let prompt = PHOTO_ANALYSIS_PROMPT;
    if (conversationContext) {
      // W-S7: Limit conversation context length to mitigate prompt injection surface
      const MAX_CONTEXT_LENGTH = 5000;
      const trimmedContext =
        typeof conversationContext === 'string'
          ? conversationContext.slice(0, MAX_CONTEXT_LENGTH)
          : '';
      if (trimmedContext) {
        prompt += `\n\nConversation so far:\n${trimmedContext}\n\nGiven this context, focus your analysis on what's most relevant to the user's concerns.`;
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
    });

    const analysis = response.text ?? '';

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'No analysis returned from Gemini' },
        { status: 500 }
      );
    }

    console.log('[analyze-photo] Analysis:', analysis.slice(0, 200));

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('[analyze-photo] Error:', error);
    // W-S8: Only expose detailed error messages in development
    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Photo analysis failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
