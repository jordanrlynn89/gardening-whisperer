'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useChat } from '@/hooks/useChat';
import { useTTS } from '@/hooks/useTTS';
import { useAmbientSound } from '@/hooks/useAmbientSound';
import { Visualizer } from './Visualizer';
import { GardenJourney, JourneyStage } from './GardenJourney';

type AppState = 'idle' | 'connecting' | 'active' | 'summary' | 'error';

function computeJourneyStage(coverage?: {
  plantIdentified: boolean;
  symptomsDiscussed: boolean;
  environmentAssessed: boolean;
  careHistoryGathered: boolean;
}): JourneyStage {
  if (!coverage) return 'start';

  if (coverage.careHistoryGathered) return 'complete';
  if (coverage.environmentAssessed) return 'care_history';
  if (coverage.symptomsDiscussed) return 'environment';
  if (coverage.plantIdentified) return 'symptoms';
  return 'plant_id';
}

export function VoiceLoop() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [volume, setVolume] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isActiveRef = useRef(false);
  const conversationStateRef = useRef<'listening' | 'thinking' | 'speaking'>('listening');
  const userTranscriptRef = useRef('');
  const [isWalking, setIsWalking] = useState(false);
  const prevStageRef = useRef<JourneyStage>('start');

  const {
    isListening,
    transcript: userTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        userTranscriptRef.current = text;
      }
      // Update volume based on transcript activity
      if (text) {
        setVolume(0.5 + Math.random() * 0.3);
      }
    },
    onSilence: () => {
      handleSilence();
      setVolume(0.1);
    },
    silenceTimeout: 1500,
  });

  const { messages, sendMessage, isLoading, lastResponse, clearMessages } = useChat();
  const { startAmbient, stopAmbient, duck, unduck } = useAmbientSound({
    volume: 0.12,
    duckingVolume: 0.04,
  });

  const { speak, isSpeaking, stop: stopSpeaking } = useTTS({
    onStart: () => {
      conversationStateRef.current = 'speaking';
      duck();
      setVolume(0.6);
    },
    onEnd: () => {
      unduck();
      setVolume(0.2);
      if (isActiveRef.current) {
        conversationStateRef.current = 'listening';
        startListening();
      }
    },
  });

  const handleSilence = useCallback(async () => {
    if (!isActiveRef.current) return;
    if (conversationStateRef.current !== 'listening') return;

    const transcript = userTranscriptRef.current.trim();
    if (!transcript) return;

    stopListening();
    conversationStateRef.current = 'thinking';
    setVolume(0.3);

    // Reset transcript BEFORE sending to avoid duplicate display
    resetTranscript();
    userTranscriptRef.current = '';

    const response = await sendMessage(transcript);

    if (response && isActiveRef.current) {
      await speak(response.spokenResponse);
    } else if (isActiveRef.current) {
      conversationStateRef.current = 'listening';
      startListening();
    }
  }, [stopListening, sendMessage, speak, resetTranscript, startListening]);

  const handleStart = async () => {
    setAppState('connecting');
    setErrorMsg(null);
    isActiveRef.current = true;
    clearMessages();
    prevStageRef.current = 'start';

    try {
      startAmbient();

      const response = await sendMessage('Hello, I need help with my plant');

      if (response && isActiveRef.current) {
        setAppState('active');
        await speak(response.spokenResponse);
      } else {
        throw new Error('Failed to get initial response');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setAppState('error');
      stopAmbient();
    }
  };

  const handleEnd = () => {
    isActiveRef.current = false;
    stopListening();
    stopSpeaking();
    stopAmbient();
    setAppState('summary');
    setVolume(0);
  };

  const handleCopySummary = () => {
    const summary = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(summary);
  };

  const handleReset = () => {
    setAppState('idle');
    setVolume(0);
  };

  // Decay volume over time
  useEffect(() => {
    const interval = setInterval(() => {
      setVolume((v) => Math.max(0.1, v * 0.95));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Compute current journey stage from coverage
  const currentStage = computeJourneyStage(lastResponse?.structured?.coverage);

  // Trigger walking animation on stage transitions
  useEffect(() => {
    if (currentStage !== prevStageRef.current) {
      setIsWalking(true);
      const timer = setTimeout(() => {
        setIsWalking(false);
        prevStageRef.current = currentStage;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentStage]);

  return (
    <div className="relative w-full h-screen bg-stone-900 overflow-hidden">
      <Visualizer volume={volume} isActive={appState === 'active'} />

      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/80 via-transparent to-stone-900/90 pointer-events-none z-0" />

      {/* IDLE */}
      {appState === 'idle' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-8 px-6 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-green-800 rounded-full flex items-center justify-center shadow-2xl shadow-green-900/50">
            <svg className="w-12 h-12 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-light text-stone-200 mb-2">
              Gardening Whisperer
            </h1>
            <p className="text-stone-400 max-w-xs mx-auto">
              An immersive, voice-first guide for your plants
            </p>
          </div>
          <button
            onClick={handleStart}
            className="group relative flex items-center justify-center w-20 h-20 bg-green-600 rounded-full hover:bg-green-500 transition-all duration-300 shadow-xl hover:shadow-green-500/30"
          >
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="absolute -bottom-10 text-sm text-stone-500 font-medium tracking-wide">
              START WALK
            </span>
          </button>
        </div>
      )}

      {/* CONNECTING */}
      {appState === 'connecting' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
          <p className="mt-4 text-stone-400 tracking-wider text-sm">
            ENTERING THE GARDEN...
          </p>
        </div>
      )}

      {/* ACTIVE */}
      {appState === 'active' && (
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Header with live indicator */}
          <div className="absolute top-0 w-full p-6 flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-stone-500 uppercase">
                Live Session
              </span>
            </div>
          </div>

          {/* Garden Journey Visual */}
          <div className="flex-1 flex items-center justify-center">
            <GardenJourney currentStage={currentStage} isWalking={isWalking} />
          </div>

          {/* Live transcript indicator */}
          {userTranscript && (
            <div className="absolute bottom-32 left-0 w-full flex justify-center px-6">
              <div className="max-w-[85%] p-3 rounded-2xl bg-stone-800/60 text-stone-300 border border-stone-700/50 backdrop-blur-sm">
                <p className="text-sm leading-relaxed italic">{userTranscript}...</p>
              </div>
            </div>
          )}

          {/* End Walk Button */}
          <div className="absolute bottom-8 right-6 z-20">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleEnd}
                className="w-14 h-14 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300"
              >
                <svg className="w-6 h-6 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="text-xs text-stone-500 font-medium">END WALK</span>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY */}
      {appState === 'summary' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 animate-in slide-in-from-bottom duration-500">
          <div className="w-full max-w-md bg-stone-800/50 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-8 shadow-2xl">
            <button
              onClick={handleReset}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-stone-700/50 hover:bg-stone-600/80 text-stone-400 hover:text-stone-200 transition-all duration-200"
              aria-label="Close summary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-900/50 rounded-xl text-green-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-stone-100">
                  Garden Walk Complete
                </h2>
                <p className="text-sm text-stone-400">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="h-64 overflow-y-auto bg-stone-900/50 rounded-xl p-4 mb-6 border border-stone-800 text-sm text-stone-300 leading-relaxed">
              {messages.length > 0 ? (
                messages.map((m, i) => (
                  <div key={i} className="mb-3">
                    <span
                      className={`font-bold text-xs uppercase ${
                        m.role === 'assistant' ? 'text-green-500' : 'text-stone-500'
                      }`}
                    >
                      {m.role === 'assistant' ? 'Gardener' : 'You'}
                    </span>
                    <p className="mt-1">{m.content}</p>
                  </div>
                ))
              ) : (
                <p className="italic text-stone-600">No conversation recorded.</p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCopySummary}
                className="flex-1 py-3 px-4 bg-stone-700 hover:bg-stone-600 rounded-xl font-medium text-stone-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Copy Summary
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 px-4 bg-green-700 hover:bg-green-600 rounded-xl font-medium text-white transition-colors"
              >
                Start New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {appState === 'error' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl text-stone-200 mb-2">Connection Error</h2>
          <p className="text-stone-400 mb-6 max-w-xs">
            {errorMsg || 'Something went wrong in the garden.'}
          </p>
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-200"
          >
            Return Home
          </button>
        </div>
      )}
    </div>
  );
}
