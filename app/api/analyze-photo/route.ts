import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const PHOTO_ANALYSIS_PROMPT = `You are a plant diagnosis assistant helping during a garden walk conversation. Analyze this photo and describe:
1. What plant you see (species if identifiable)
2. Overall health — does it look healthy, stressed, or sick?
3. Any visible issues: discoloration, spots, wilting, pests, damage
4. Notable details about leaves, stems, soil, or surroundings

Keep your description conversational and concise (3-5 sentences). This will be read aloud to the user, so be natural and direct.`;

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
      prompt += `\n\nConversation so far:\n${conversationContext}\n\nGiven this context, focus your analysis on what's most relevant to the user's concerns.`;
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Photo analysis failed',
      },
      { status: 500 }
    );
  }
}
