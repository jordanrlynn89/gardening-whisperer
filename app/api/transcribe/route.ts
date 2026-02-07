import { NextRequest } from 'next/server';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

if (!process.env.DEEPGRAM_API_KEY) {
  console.warn('DEEPGRAM_API_KEY is not set - Deepgram transcription will not work');
}

const deepgram = process.env.DEEPGRAM_API_KEY
  ? createClient(process.env.DEEPGRAM_API_KEY)
  : null;

export async function POST(request: NextRequest) {
  if (!deepgram) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Deepgram API key not configured'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { audioData } = await request.json();

    if (!audioData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Audio data required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 50 MB max for audio data
    const MAX_AUDIO_SIZE = 50 * 1024 * 1024;
    if (audioData.length > MAX_AUDIO_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'Audio too large (max 50 MB)' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64');

    // Transcribe using Deepgram pre-recorded API (for audio chunks)
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
        language: 'en-US',
      }
    );

    if (error) {
      console.error('[Deepgram] Transcription error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Transcription failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    console.log('[Deepgram] Transcription:', transcript);

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        isFinal: true,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Deepgram] API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
