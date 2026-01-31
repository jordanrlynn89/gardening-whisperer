'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useChat } from '@/hooks/useChat';
import { useTTS } from '@/hooks/useTTS';
import { useAmbientSound } from '@/hooks/useAmbientSound';

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
        // Store in ref immediately
        userTranscriptRef.current = text;
      }
    },
    onSilence: () => {
      handleSilence();
    },
    silenceTimeout: 1500, // Reduced from 2500ms for snappier responses
  });

  // Gemini Chat (AI)
  const { messages, sendMessage, lastResponse, isLoading } = useChat();

  // Ambient garden sounds for immersion
  const {
    startAmbient,
    stopAmbient,
    duck,
    unduck,
  } = useAmbientSound({ volume: 0.12, duckingVolume: 0.04 });

  // Text-to-Speech (TTS)
  const { speak, isSpeaking, stop: stopSpeaking } = useTTS({
    onStart: () => {
      setConversationState('speaking');
      duck(); // Lower ambient volume while AI speaks
    },
    onEnd: () => {
      unduck(); // Restore ambient volume
      // Resume listening after speaking
      if (isActiveRef.current) {
        setConversationState('listening');
        startListening(); // Restart Web Speech API
      } else {
        setConversationState('idle');
      }
    },
  });

  // Handle silence detection
  const handleSilence = useCallback(async () => {
    if (!isActiveRef.current) return;
    if (conversationStateRef.current !== 'listening') return;

    const transcript = userTranscriptRef.current.trim();
    if (!transcript) return;

    // Stop listening while we process
    stopListening();
    setConversationState('thinking');

    // Send to Gemini
    const response = await sendMessage(transcript);

    if (response && isActiveRef.current) {
      // Speak the response
      await speak(response.spokenResponse);
    } else {
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
  const handleStart = async () => {
    setIsActive(true);
    setConversationState('thinking');

    // Start immersive garden ambiance
    startAmbient();

    // Send initial greeting to trigger garden walk introduction
    const response = await sendMessage('Hello, I need help with my plant');

    if (response && isActiveRef.current) {
      await speak(response.spokenResponse);
    }
  };

  // Stop conversation
  const handleStop = () => {
    setIsActive(false);
    setConversationState('idle');
    stopListening();
    stopSpeaking();
    stopAmbient(); // Fade out garden sounds
  };

  // Check if diagnosis is complete
  const isDiagnosisComplete = lastResponse?.structured.diagnosis !== undefined;

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
                  className="px-6 py-3 bg-garden-600 text-white rounded-lg font-medium hover:bg-garden-700 transition-colors shadow-md hover:shadow-lg"
                >
                  {isDiagnosisComplete ? '🌱 Start New Garden Walk' : '🌱 Start Garden Walk'}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors shadow-md ${
                    isDiagnosisComplete
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isDiagnosisComplete ? '✅ Complete' : 'Stop'}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                🌱 Garden Walk Progress
              </h3>
              <div className="text-sm font-medium text-gray-600">
                {(() => {
                  const completed = Object.values(lastResponse.structured.coverage).filter(Boolean).length;
                  const total = Object.keys(lastResponse.structured.coverage).length;
                  const percentage = Math.round((completed / total) * 100);
                  return `${percentage}% Complete`;
                })()}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-garden-600 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    (Object.values(lastResponse.structured.coverage).filter(Boolean).length /
                      Object.keys(lastResponse.structured.coverage).length) *
                    100
                  }%`,
                }}
              />
            </div>

            {/* Coverage Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'plantIdentified', label: 'Plant Type', icon: '🪴', category: 'plant_id' },
                { key: 'symptomsDiscussed', label: 'Symptoms', icon: '🔍', category: 'symptoms' },
                { key: 'environmentAssessed', label: 'Environment', icon: '☀️', category: 'environment' },
                { key: 'careHistoryGathered', label: 'Care History', icon: '📅', category: 'care_history' },
              ].map(({ key, label, icon, category }) => {
                const isComplete = lastResponse.structured.coverage[key as keyof typeof lastResponse.structured.coverage];
                const isActive = lastResponse.structured.nextAction?.category === category;

                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                      isComplete
                        ? 'bg-green-50 border-green-400 shadow-sm'
                        : isActive
                        ? 'bg-blue-50 border-blue-400 shadow-md ring-2 ring-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{isComplete ? '✅' : isActive ? '💬' : icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">{label}</div>
                        {isActive && !isComplete && (
                          <div className="text-xs text-blue-600 mt-0.5">Discussing now...</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Phase Indicator */}
            {lastResponse.structured.nextAction?.type === 'wrap_up' && (
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                <div className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <span>🎉</span>
                  <span>Ready for diagnosis!</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diagnosis & Actions */}
        {lastResponse?.structured.diagnosis && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-garden-400">
            <h3 className="text-lg font-semibold text-garden-900 mb-4 flex items-center gap-2">
              <span>🔬</span>
              <span>Diagnosis</span>
            </h3>

            <div className="space-y-4">
              {/* Condition */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Likely Condition:</div>
                <div className="text-lg font-bold text-gray-900">
                  {lastResponse.structured.diagnosis.condition}
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({lastResponse.structured.diagnosis.confidence})
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Why:</div>
                <div className="text-sm text-gray-700">{lastResponse.structured.diagnosis.reasoning}</div>
              </div>

              {/* Symptoms */}
              {lastResponse.structured.diagnosis.symptoms && (
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">Observed Symptoms:</div>
                  <ul className="text-sm text-gray-700 list-disc list-inside">
                    {lastResponse.structured.diagnosis.symptoms.map((symptom, idx) => (
                      <li key={idx}>{symptom}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Alternatives */}
              {lastResponse.structured.diagnosis.alternatives && lastResponse.structured.diagnosis.alternatives.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">Could Also Be:</div>
                  <ul className="text-sm text-gray-700 list-disc list-inside">
                    {lastResponse.structured.diagnosis.alternatives.map((alt, idx) => (
                      <li key={idx}>{alt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Plan */}
        {lastResponse?.structured.actions && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-blue-400">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <span>📋</span>
              <span>Action Plan</span>
            </h3>

            <div className="space-y-4">
              {/* Do Today */}
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <span>⚡</span>
                  <span>Do This Today:</span>
                </div>
                <ul className="text-sm text-red-900 space-y-1">
                  {lastResponse.structured.actions.doToday.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Check In */}
              {lastResponse.structured.actions.checkInDays && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <span>📅</span>
                    <span>Check again in {lastResponse.structured.actions.checkInDays} days</span>
                  </div>
                </div>
              )}

              {/* If Worsens */}
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>If This Worsens:</span>
                </div>
                <ul className="text-sm text-yellow-900 space-y-1">
                  {lastResponse.structured.actions.ifWorsens.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
              💡 How the Garden Walk Works:
            </h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Click "Start Conversation" and the AI will greet you</li>
              <li>• Answer questions naturally about your plant</li>
              <li>• The AI will ask about 4 areas: plant type, symptoms, environment, and care history</li>
              <li>• Watch the progress bar fill as you provide information</li>
              <li>• After 2-3 seconds of silence, the AI will respond</li>
              <li>• When all info is gathered, you'll get a diagnosis and action plan</li>
            </ul>
            <div className="mt-4 p-3 bg-green-100 rounded border border-green-300">
              <div className="text-xs font-semibold text-green-900 mb-1">✨ Tip for Demo:</div>
              <div className="text-xs text-green-800">
                Try: "My tomato plant has yellowing leaves at the bottom. It's outdoors in full sun. I water it every 2-3 days."
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
