import { NextRequest, NextResponse } from 'next/server';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not set in environment variables');
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Default voice: Rachel (friendly, warm female voice)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId = DEFAULT_VOICE_ID } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Call ElevenLabs TTS API with streaming optimization
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4&output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5', // Flash model is faster than turbo
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs API error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate speech' },
        { status: response.status }
      );
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer();

    // Return audio as base64
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: `data:audio/mpeg;base64,${base64Audio}`,
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
