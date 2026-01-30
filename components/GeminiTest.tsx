'use client';

import { useState } from 'react';
import { useChat } from '@/hooks/useChat';

export function GeminiTest() {
  const { messages, isLoading, error, sendMessage, clearMessages, lastResponse } = useChat();
  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-garden-900">
        🌿 Gemini API Test
      </h1>

      {/* Controls */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={clearMessages}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Clear Conversation
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Conversation History */}
      <div className="mb-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg ${
              msg.role === 'user'
                ? 'bg-garden-100 border border-garden-200'
                : 'bg-earth-100 border border-earth-200'
            }`}
          >
            <div className="font-semibold text-sm mb-1">
              {msg.role === 'user' ? '👤 You' : '🌱 Assistant'}
            </div>
            <p className="text-gray-900">{msg.content}</p>
          </div>
        ))}
      </div>

      {/* Structured Response (Layer 1) */}
      {lastResponse && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            📊 Structured Data (Layer 1)
          </h3>
          <pre className="text-xs text-blue-800 overflow-x-auto">
            {JSON.stringify(lastResponse.structured, null, 2)}
          </pre>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message about your plant..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-garden-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-garden-600 text-white rounded-lg font-medium hover:bg-garden-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Test Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Try: "My tomato plant has yellowing leaves"</li>
          <li>• Try: "It's in full sun and I water it daily"</li>
          <li>• Watch the structured data to see coverage tracking</li>
          <li>• The spoken response will be used for TTS later</li>
        </ul>
      </div>
    </div>
  );
}
