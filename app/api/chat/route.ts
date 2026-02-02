import { NextRequest, NextResponse } from 'next/server';
import { sendToGemini } from '@/lib/gemini';
import { ChatApiResponse, ChatRequest } from '@/types/chat';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    const { message, conversationHistory, imageData } = body;

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message is required',
        } as ChatApiResponse,
        { status: 400 }
      );
    }

    // Call Gemini API
    const response = await sendToGemini(message, conversationHistory, imageData);

    // Debug logging
    console.log('[Chat API] Gemini response:', JSON.stringify({
      nextAction: response.structured?.nextAction,
      spokenResponse: response.spokenResponse,
    }));

    return NextResponse.json({
      success: true,
      data: response,
    } as ChatApiResponse);
  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ChatApiResponse,
      { status: 500 }
    );
  }
}
