import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Initialize client with API key or service account
const getClient = () => {
  if (process.env.GOOGLE_CLOUD_API_KEY) {
    // Use API key authentication (simpler for hackathon)
    return new TextToSpeechClient({
      apiKey: process.env.GOOGLE_CLOUD_API_KEY,
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use service account JSON file path
    return new TextToSpeechClient();
  } else {
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const client = getClient();

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Cloud TTS not configured. Set GOOGLE_CLOUD_API_KEY or GOOGLE_APPLICATION_CREDENTIALS'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, voiceId = 'en-US-Neural2-F' } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Parse voice ID (format: languageCode-voiceName, e.g., "en-US-Neural2-F")
    const [languageCode, ...voiceNameParts] = voiceId.split('-');
    const voiceName = voiceNameParts.join('-');
    const fullLanguageCode = voiceId.substring(0, 5); // e.g., "en-US"

    // Construct the request for WaveNet voice
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: fullLanguageCode,
        name: voiceId,
        ssmlGender: 'FEMALE', // or detect from voice name
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: 0,
        speakingRate: 1.0,
      },
    });

    if (!response.audioContent) {
      throw new Error('No audio content in response');
    }

    // Convert audio content to base64
    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    const base64Audio = audioBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      audio: `data:audio/mpeg;base64,${base64Audio}`,
    });
  } catch (error) {
    console.error('Google Cloud TTS API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
