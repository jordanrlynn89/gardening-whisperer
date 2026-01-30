'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useChat } from '@/hooks/useChat';
import { useTTS } from '@/hooks/useTTS';

type ConversationState = 'idle' | 'listening' | 'thinking' | 'speaking';

export function VoiceLoop() {
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [isActive, setIsActive] = useState(false);

  // Use refs to access latest values in callbacks
  const isActiveRef = useRef(false);
  const conversationStateRef = useRef<ConversationState>('idle');

  // Update refs when state changes
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    conversationStateRef.current = conversationState;
  }, [conversationState]);

  // Ref to store the latest transcript
  const userTranscriptRef = useRef('');

  // Speech Recognition (STT)
  const {
    isListening,
    transcript: userTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        console.log('[Voice Loop] Final transcript:', text);
        // Store in ref immediately
        userTranscriptRef.current = text;
      }
    },
    onSilence: () => {
      console.log('[Voice Loop] Silence detected');
      handleSilence();
    },
    silenceTimeout: 2500,
  });

  // Gemini Chat (AI)
  const { messages, sendMessage, lastResponse, isLoading } = useChat();

  // Text-to-Speech (TTS)
  const { speak, isSpeaking, stop: stopSpeaking } = useTTS({
    onStart: () => {
      console.log('[Voice Loop] Started speaking');
      setConversationState('speaking');
    },
    onEnd: () => {
      console.log('[Voice Loop] Finished speaking');
      // Resume listening after speaking
      if (isActive) {
        setConversationState('listening');
      } else {
        setConversationState('idle');
      }
    },
  });

  // Handle silence detection
  const handleSilence = useCallback(async () => {
    console.log('[Voice Loop] Silence callback fired');
    console.log('[Voice Loop] isActive (ref):', isActiveRef.current);
    console.log('[Voice Loop] conversationState (ref):', conversationStateRef.current);
    console.log('[Voice Loop] userTranscript (ref):', userTranscriptRef.current);

    if (!isActiveRef.current) {
      console.log('[Voice Loop] Not active, skipping');
      return;
    }

    if (conversationStateRef.current !== 'listening') {
      console.log('[Voice Loop] Not in listening state, skipping');
      return;
    }

    const transcript = userTranscriptRef.current.trim();

    if (!transcript) {
      console.log('[Voice Loop] No transcript, skipping');
      return;
    }

    console.log('[Voice Loop] Processing transcript:', transcript);

    // Stop listening while we process
    stopListening();
    setConversationState('thinking');

    // Send to Gemini
    console.log('[Voice Loop] Sending to Gemini...');
    const response = await sendMessage(transcript);
    console.log('[Voice Loop] Gemini response:', response);

    if (response && isActiveRef.current) {
      // Speak the response
      console.log('[Voice Loop] Speaking response:', response.spokenResponse);
      await speak(response.spokenResponse);
    } else {
      console.log('[Voice Loop] No response or not active');
      // Resume listening if we didn't get a response
      if (isActiveRef.current) {
        setConversationState('listening');
      }
    }

    // Reset transcript for next turn
    resetTranscript();
    userTranscriptRef.current = '';
  }, [
    stopListening,
    sendMessage,
    speak,
    resetTranscript,
  ]);

  // Start conversation
  const handleStart = () => {
    setIsActive(true);
    setConversationState('listening');
    startListening();
  };

  // Stop conversation
  const handleStop = () => {
    setIsActive(false);
    setConversationState('idle');
    stopListening();
    stopSpeaking();
  };

  // Update conversation state based on hooks
  useEffect(() => {
    if (!isActive) return;

    if (isSpeaking) {
      setConversationState('speaking');
    } else if (isLoading) {
      setConversationState('thinking');
    } else if (isListening) {
      setConversationState('listening');
    }
  }, [isActive, isSpeaking, isLoading, isListening]);

  // Get state display info
  const getStateInfo = () => {
    switch (conversationState) {
      case 'listening':
        return {
          color: 'bg-green-500',
          text: 'Listening...',
          icon: '🎤',
          description: 'Speak to me',
        };
      case 'thinking':
        return {
          color: 'bg-blue-500',
          text: 'Thinking...',
          icon: '🤔',
          description: 'Processing your message',
        };
      case 'speaking':
        return {
          color: 'bg-purple-500',
          text: 'Speaking...',
          icon: '🔊',
          description: 'Listening to response',
        };
      default:
        return {
          color: 'bg-gray-300',
          text: 'Ready',
          icon: '🌱',
          description: 'Press Start to begin',
        };
    }
  };

  const stateInfo = getStateInfo();

  return (
    <div className="min-h-screen bg-gradient-to-b from-garden-50 to-earth-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-garden-900 mb-2">
            🌱 Gardening Whisperer
          </h1>
          <p className="text-lg text-earth-600">
            Your voice-first AI gardening assistant
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-full ${stateInfo.color} animate-pulse`} />
              <div>
                <div className="text-2xl font-semibold text-gray-900">
                  {stateInfo.icon} {stateInfo.text}
                </div>
                <div className="text-sm text-gray-600">{stateInfo.description}</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              {!isActive ? (
                <button
                  onClick={handleStart}
                  className="px-6 py-3 bg-garden-600 text-white rounded-lg font-medium hover:bg-garden-700 transition-colors"
                >
                  Start Conversation
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Current Transcript */}
          {isActive && userTranscript && (
            <div className="mt-4 p-4 bg-garden-50 border border-garden-200 rounded-lg">
              <div className="text-sm font-semibold text-garden-700 mb-1">
                You're saying:
              </div>
              <div className="text-gray-900">{userTranscript}</div>
            </div>
          )}
        </div>

        {/* Coverage Tracking */}
        {lastResponse?.structured.coverage && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Garden Walk Progress
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(lastResponse.structured.coverage).map(([key, value]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border-2 ${
                    value
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{value ? '✅' : '⏳'}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversation History */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            💬 Conversation
          </h3>

          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">No conversation yet</p>
              <p className="text-sm">
                Press "Start Conversation" and tell me about your plant!
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-garden-100 border border-garden-200'
                      : 'bg-earth-100 border border-earth-200'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1 text-gray-700">
                    {msg.role === 'user' ? '👤 You' : '🌱 Assistant'}
                  </div>
                  <div className="text-gray-900">{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        {!isActive && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">
              💡 How to use:
            </h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Click "Start Conversation" to begin</li>
              <li>• Speak naturally about your plant's issues</li>
              <li>• Wait 2-3 seconds of silence for AI to respond</li>
              <li>• The AI will speak responses back to you</li>
              <li>• Continue the conversation until diagnosis is complete</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
