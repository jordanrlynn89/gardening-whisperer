'use client';

import { useState } from 'react';
import { useTTS } from '@/hooks/useTTS';

export function TTSTest() {
  const [input, setInput] = useState('Hello! I\'m your friendly gardening assistant. How can I help you today?');
  const { speak, isSpeaking, error, stop } = useTTS({
    onStart: () => console.log('🔊 Started speaking'),
    onEnd: () => console.log('✅ Finished speaking'),
    onError: (err) => console.error('❌ TTS error:', err),
  });

  const handleSpeak = async () => {
    if (input.trim()) {
      await speak(input.trim());
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-garden-900">
        🔊 Text-to-Speech Test
      </h1>

      {/* Status Indicator */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full ${
            isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
          }`}
        />
        <span className="text-lg font-medium">
          {isSpeaking ? 'Speaking...' : 'Ready'}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Text to speak:
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garden-500 resize-none"
          placeholder="Enter text to convert to speech..."
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleSpeak}
          disabled={isSpeaking || !input.trim()}
          className="px-6 py-3 bg-garden-600 text-white rounded-lg font-medium hover:bg-garden-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSpeaking ? 'Speaking...' : '🔊 Speak'}
        </button>
        {isSpeaking && (
          <button
            onClick={stop}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            ⏹ Stop
          </button>
        )}
      </div>

      {/* Quick Test Phrases */}
      <div className="mt-8 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick test phrases:</h3>
        {[
          'Got it. Tell me more about the yellowing leaves.',
          'I see. How much sun does your tomato plant get each day?',
          'That sounds like nitrogen deficiency. The yellowing from the bottom up is a classic sign.',
        ].map((phrase, idx) => (
          <button
            key={idx}
            onClick={() => setInput(phrase)}
            className="block w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm text-blue-900 transition-colors"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Type or select a phrase above</li>
          <li>• Click "Speak" to hear it spoken aloud</li>
          <li>• Using Rachel voice (friendly, warm female)</li>
          <li>• Check console for event logs</li>
        </ul>
      </div>
    </div>
  );
}
