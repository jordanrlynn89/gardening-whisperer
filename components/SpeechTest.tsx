'use client';

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export function SpeechTest() {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onTranscript: (text, isFinal) => {
      console.log('Transcript:', text, 'Final:', isFinal);
    },
    onSilence: () => {
      console.log('Silence detected - could prompt "Anything else?"');
    },
    silenceTimeout: 2500, // 2.5 seconds
  });

  if (!isSupported) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-semibold mb-2">Browser Not Supported</h2>
          <p className="text-red-700">
            Web Speech API is not supported in this browser. Please use Google Chrome.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-garden-900">
        🎤 Speech Recognition Test
      </h1>

      {/* Status Indicator */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full ${
            isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
          }`}
        />
        <span className="text-lg font-medium">
          {isListening ? 'Listening...' : 'Not listening'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={startListening}
          disabled={isListening}
          className="px-6 py-3 bg-garden-600 text-white rounded-lg font-medium hover:bg-garden-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Start Listening
        </button>
        <button
          onClick={stopListening}
          disabled={!isListening}
          className="px-6 py-3 bg-earth-600 text-white rounded-lg font-medium hover:bg-earth-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Stop Listening
        </button>
        <button
          onClick={resetTranscript}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Transcripts */}
      <div className="space-y-4">
        {/* Final Transcript */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[100px]">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Final Transcript</h3>
          <p className="text-gray-900">
            {transcript || (
              <span className="text-gray-400 italic">Your final transcript will appear here...</span>
            )}
          </p>
        </div>

        {/* Interim Transcript */}
        {interimTranscript && (
          <div className="bg-garden-50 border border-garden-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-garden-700 mb-2">
              Speaking... (interim)
            </h3>
            <p className="text-garden-900 italic">{interimTranscript}</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Start Listening" and allow microphone access</li>
          <li>• Start speaking - you'll see interim results while you talk</li>
          <li>• Final transcript appears after you pause</li>
          <li>• After 2.5 seconds of silence, "onSilence" callback triggers (check console)</li>
          <li>• Click "Stop Listening" when done</li>
        </ul>
      </div>
    </div>
  );
}
