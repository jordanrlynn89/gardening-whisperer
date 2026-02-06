const { GoogleGenAI, Modality } = require('@google/genai');

const SYSTEM_PROMPT = `You are a friendly, warm gardening assistant called "Gardening Whisperer." You're taking the user on a "garden walk" — a voice conversation to diagnose plant issues.

Your personality:
- Warm, encouraging, simple language
- Short responses (1-3 sentences max, optimized for voice)
- Start responses with brief acknowledgment ("Got it.", "I see.", "Right.")
- Use confident but not absolute language like "It's likely..." or "I suspect..."

THE GARDEN WALK PROCESS — follow ALL of these stages in order. Do NOT skip stages.

1. START: When the conversation begins, say exactly: "Let's take a walk. Can you tell me a little about your plant and what you are observing?"

2. PLANT ID: Ask what kind of plant they have. Wait for their answer before moving on. Acknowledge what they tell you.

3. SYMPTOMS: Ask specific questions about what they're seeing — color changes, spots, wilting, drooping, holes, texture. Dig into the details. Ask follow-up questions if their description is vague.

4. ENVIRONMENT: Ask about sun exposure, where the plant lives (indoor/outdoor), soil type, and recent weather or temperature changes.

5. CARE HISTORY: Ask about their watering routine, any fertilizer use, when they got the plant, and any recent changes (repotting, moving, new products).

6. DIAGNOSIS: Once you've covered all the above, offer a probable cause using confident but not absolute language ("It's likely..." or "I suspect..."). Include:
   - What you think is wrong
   - What to do today
   - What to watch for if it worsens

7. ASK FOR MORE: After giving the diagnosis, ask the user if they have anything else to add or another plant they'd like to discuss. Wait for their response. Examples:
   - "Is there anything else you'd like to tell me about this plant?"
   - "Do you have another plant you'd like to discuss?"
   - "Anything else I should know, or is that everything?"
   - If they say "no", "that's all", "I'm good", or similar, proceed to WRAP UP
   - If they say "yes" or mention another plant/issue, start a new discussion cycle from PLANT ID

8. WRAP UP: Only after asking about more plants/info and hearing their response, end the walk clearly. You MUST include the exact phrase "happy gardening" in your final message. For example: "That wraps up our walk! Happy gardening!" or "I think we've covered everything. Happy gardening!"

IMPORTANT RULES:
- Follow EVERY stage in order — do not skip ahead even if the user volunteers info early. Acknowledge it and still ask your questions for that stage.
- Only move to the next stage after you've gathered enough info for the current one.
- If the user's description is vague, suggest they show you a photo: "Would you like to show me a picture?"
- Keep the conversation natural and flowing, like a knowledgeable gardener friend
- Each response should be short (1-3 sentences) since this is voice conversation
- Always end with a clear wrap-up containing "happy gardening" so the user knows the walk is over`;

class GeminiLiveProxy {
  constructor(clientWs) {
    this.clientWs = clientWs;
    this.session = null;
    this.isConnected = false;
    this._accumulatedAiText = '';
  }

  async connect() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log('[GeminiLive] Connecting to Gemini Live API...');

    this.session = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log('[GeminiLive] Connected to Gemini');
          this.isConnected = true;
        },
        onmessage: (msg) => {
          this._handleGeminiMessage(msg);
        },
        onerror: (e) => {
          console.error('[GeminiLive] Error:', e);
          this._sendToClient({
            type: 'error',
            message: 'Gemini connection error',
          });
        },
        onclose: (e) => {
          console.log('[GeminiLive] Connection closed:', e?.code, e?.reason);
          this.isConnected = false;
          this._sendToClient({ type: 'closed' });
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
          languageCode: 'en-US',
        },
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });

    console.log('[GeminiLive] Session created');

    // Send initial text to trigger the garden walk opening
    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [{ text: 'Start the garden walk' }],
        },
      ],
      turnComplete: true,
    });
  }

  handleClientMessage(data) {
    if (!this.session || !this.isConnected) {
      console.warn('[GeminiLive] Not connected, ignoring client message');
      return;
    }

    try {
      // Check if it's a JSON control message
      if (data[0] === 0x7b) {
        // starts with '{'
        const msg = JSON.parse(data.toString());

        if (msg.type === 'text') {
          // Text message (e.g., photo description)
          this.session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: msg.text }],
              },
            ],
            turnComplete: true,
          });
          return;
        }

        if (msg.type === 'image') {
          // Image data for photo analysis
          this.session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [
                  { text: msg.text || 'Here is a photo of my plant. What do you see?' },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: msg.imageData,
                    },
                  },
                ],
              },
            ],
            turnComplete: true,
          });
          return;
        }
      }
    } catch {
      // Not JSON, treat as raw audio
    }

    // Raw audio data — forward to Gemini
    // Client sends 16-bit PCM, 16kHz, mono as raw bytes
    // Send as base64-encoded inline data (Node.js Blob doesn't carry mime type properly)
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.session.sendRealtimeInput({
      media: {
        mimeType: 'audio/pcm;rate=16000',
        data: buf.toString('base64'),
      },
    });
  }

  _handleGeminiMessage(msg) {
    if (msg.setupComplete) {
      console.log('[GeminiLive] Setup complete, session:', msg.setupComplete.sessionId);
      this._sendToClient({
        type: 'setup_complete',
        sessionId: msg.setupComplete.sessionId,
      });
      return;
    }

    if (msg.serverContent) {
      const content = msg.serverContent;

      // Input transcription (what the user said)
      if (content.inputTranscription?.text) {
        console.log('[GeminiLive] User said:', content.inputTranscription.text);
        this._sendToClient({
          type: 'input_transcript',
          text: content.inputTranscription.text,
        });
      }

      // Output transcription (what Gemini is saying)
      if (content.outputTranscription?.text) {
        console.log('[GeminiLive] AI says:', content.outputTranscription.text);
        this._accumulatedAiText += content.outputTranscription.text;
        this._sendToClient({
          type: 'output_transcript',
          text: content.outputTranscription.text,
        });
      }

      // Audio data from model
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            // Send raw audio bytes to client for playback
            // Gemini returns audio as base64
            const audioBytes = Buffer.from(part.inlineData.data, 'base64');
            this.clientWs.send(audioBytes, { binary: true });
          }
        }
      }

      // Turn complete signal
      if (content.turnComplete) {
        console.log('[GeminiLive] Turn complete');
        // Check if the AI said "happy gardening" — signals walk is done
        if (this._accumulatedAiText && this._accumulatedAiText.toLowerCase().includes('happy gardening')) {
          console.log('[GeminiLive] 🌟 Walk complete detected — "happy gardening" found');
          this._sendToClient({ type: 'walk_complete' });
        }
        this._accumulatedAiText = '';
        this._sendToClient({ type: 'turn_complete' });
      }

      // Interrupted (user started speaking while AI was responding)
      if (content.interrupted) {
        console.log('[GeminiLive] Turn interrupted by user');
        this._sendToClient({ type: 'interrupted' });
      }
    }
  }

  _sendToClient(msg) {
    if (this.clientWs.readyState === 1) {
      // WebSocket.OPEN
      const jsonStr = JSON.stringify(msg);
      console.log(`[GeminiLive] Sending to client: ${msg.type} (${jsonStr.length} bytes)`);
      this.clientWs.send(jsonStr);
    } else {
      console.warn(`[GeminiLive] Cannot send message, WebSocket not open (state: ${this.clientWs.readyState})`);
    }
  }

  disconnect() {
    if (this.session) {
      try {
        this.session.close();
      } catch (e) {
        console.error('[GeminiLive] Error closing session:', e);
      }
      this.session = null;
    }
    this.isConnected = false;
  }
}

module.exports = { GeminiLiveProxy };
