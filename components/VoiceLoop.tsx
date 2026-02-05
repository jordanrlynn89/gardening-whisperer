'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useAmbientSound } from '@/hooks/useAmbientSound';
import { Visualizer } from './Visualizer';
import { GardenJourney, JourneyStage } from './GardenJourney';
import PhotoChooser from './PhotoChooser';
import { CameraCapture } from './CameraCapture';
import PhotoLibrary from './PhotoLibrary';

type AppState = 'idle' | 'connecting' | 'active' | 'summary' | 'error';
type PhotoState = 'none' | 'choosing_source' | 'capturing_camera' | 'selecting_library' | 'processing';

// Detect what stage the walk is in by scanning AI messages for stage-specific questions.
// Stages advance progressively — once we pass a stage, we don't go back.
const STAGE_ORDER: JourneyStage[] = ['start', 'plant_id', 'symptoms', 'environment', 'care_history', 'complete'];

function detectStageFromMessages(messages: { role: string; content: string }[]): JourneyStage {
  // Simplified stage detection based on message count and content patterns
  // Progress through stages based on number of back-and-forth exchanges

  if (messages.length === 0) return 'start';

  let stageIndex = 0;
  let userMessageCount = 0;

  for (const msg of messages) {
    const lower = msg.content.toLowerCase();

    if (msg.role === 'user') {
      userMessageCount++;
    }

    if (msg.role !== 'assistant') continue;

    // Check for completion/diagnosis - AI giving recommendations or diagnosis
    if (
      lower.includes('happy gardening') ||
      lower.includes("it's likely") ||
      lower.includes('i suspect') ||
      lower.includes('i think it') ||
      lower.includes('sounds like') ||
      lower.includes('i\'d recommend') ||
      lower.includes('my recommendation') ||
      lower.includes('what to do today') ||
      lower.includes('do today') ||
      lower.includes('root rot') ||
      lower.includes('fungal') ||
      lower.includes('bacterial') ||
      lower.includes('deficien') ||
      lower.includes('overwater') ||
      lower.includes('underwater') ||
      (lower.includes('caused by') && lower.length > 50) // diagnosis explanation
    ) {
      stageIndex = Math.max(stageIndex, 5);
    }
    // Check for care/watering questions
    else if (
      lower.includes('water') ||
      lower.includes('fertiliz') ||
      lower.includes('care') ||
      lower.includes('routine') ||
      lower.includes('how long have you had')
    ) {
      stageIndex = Math.max(stageIndex, 4);
    }
    // Check for environment questions
    else if (
      lower.includes('sun') ||
      lower.includes('light') ||
      lower.includes('indoor') ||
      lower.includes('outdoor') ||
      lower.includes('where') ||
      lower.includes('soil') ||
      lower.includes('temperature')
    ) {
      stageIndex = Math.max(stageIndex, 3);
    }
    // Check for symptom questions
    else if (
      lower.includes('symptom') ||
      lower.includes('yellow') ||
      lower.includes('brown') ||
      lower.includes('spot') ||
      lower.includes('wilt') ||
      lower.includes('droop') ||
      lower.includes('color') ||
      lower.includes('leaves') ||
      lower.includes('describe') ||
      lower.includes('seeing') ||
      lower.includes('notice')
    ) {
      stageIndex = Math.max(stageIndex, 2);
    }
    // Check for plant_id (walk started)
    else if (lower.includes('take a walk') || lower.includes('kind of plant')) {
      stageIndex = Math.max(stageIndex, 1);
    }
  }

  // Fallback: use message count to estimate stage if keywords didn't trigger
  // After user speaks 2+ times, should be at least symptoms
  if (userMessageCount >= 2 && stageIndex < 2) {
    stageIndex = 2;
  }
  // After user speaks 3+ times, should be at least environment
  if (userMessageCount >= 3 && stageIndex < 3) {
    stageIndex = 3;
  }
  // After user speaks 4+ times, should be at least care_history
  if (userMessageCount >= 4 && stageIndex < 4) {
    stageIndex = 4;
  }

  return STAGE_ORDER[stageIndex];
}

export function VoiceLoop() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [volume, setVolume] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<PhotoState>('none');
  const [isWalking, setIsWalking] = useState(false);
  const prevStageRef = useRef<JourneyStage>('start');

  const { startAmbient, stopAmbient, duck, unduck } = useAmbientSound({
    volume: 0.12,
    duckingVolume: 0.04,
  });

  const {
    connect,
    disconnect,
    sendImage,
    pauseMic,
    resumeMic,
    isConnected,
    isListening,
    isSpeaking,
    userTranscript,
    aiTranscript,
    messages,
    error: geminiError,
  } = useGeminiLive({
    onSpeakingStart: () => {
      duck();
      setVolume(0.6);
    },
    onSpeakingEnd: () => {
      unduck();
      setVolume(0.2);
    },
    onConnected: () => {
      setAppState('active');
    },
    onError: (err) => {
      setErrorMsg(err);
    },
    onWalkComplete: () => {
      console.log('[VoiceLoop] Walk complete signal received');
      setTimeout(() => {
        disconnect();
        stopAmbient();
        setAppState('summary');
        setVolume(0);
      }, 2000);
    },
  });

  // Update volume based on listening/speaking state
  useEffect(() => {
    if (isListening && !isSpeaking) {
      setVolume(0.3 + Math.random() * 0.2);
    }
  }, [isListening, isSpeaking, userTranscript]);

  // Decay volume over time
  useEffect(() => {
    const interval = setInterval(() => {
      setVolume((v) => Math.max(0.1, v * 0.95));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Helper to check if text contains photo-related triggers
  const hasPhotoTrigger = (text: string, source: 'ai' | 'user') => {
    const lower = text.toLowerCase();
    if (source === 'ai') {
      return (
        lower.includes('show me a picture') ||
        lower.includes('show me a photo') ||
        lower.includes('send me a photo') ||
        lower.includes('take a picture') ||
        lower.includes('like to see') ||
        lower.includes('see a photo') ||
        lower.includes('see a picture') ||
        lower.includes('photo of') ||
        lower.includes('picture of') ||
        lower.includes('send a photo')
      );
    }
    return (
      lower.includes('show you') ||
      lower.includes('take a picture') ||
      lower.includes('take a photo') ||
      lower.includes('send a picture') ||
      lower.includes('send you a photo') ||
      lower.includes('upload') ||
      lower.includes('let me show')
    );
  };

  // Detect photo triggers from completed messages (full sentences, most reliable)
  const lastMessageRef = useRef(0);
  useEffect(() => {
    if (messages.length <= lastMessageRef.current) return;
    // Check only new messages
    const newMessages = messages.slice(lastMessageRef.current);
    lastMessageRef.current = messages.length;

    for (const msg of newMessages) {
      const source = msg.role === 'assistant' ? 'ai' : 'user';
      if (hasPhotoTrigger(msg.content, source) && photoState === 'none') {
        console.log('[VoiceLoop] Photo trigger detected in completed message:', msg.content);
        setPhotoState('choosing_source');
        break;
      }
    }
  }, [messages, photoState]);

  // Also detect from streaming transcripts (faster, but less reliable)
  useEffect(() => {
    if (!aiTranscript || photoState !== 'none') return;
    if (hasPhotoTrigger(aiTranscript, 'ai')) {
      // Wait for AI to finish speaking before showing photo UI
      const waitForSpeechEnd = setInterval(() => {
        if (!isSpeaking) {
          clearInterval(waitForSpeechEnd);
          setPhotoState('choosing_source');
        }
      }, 200);
      return () => clearInterval(waitForSpeechEnd);
    }
  }, [aiTranscript, isSpeaking, photoState]);

  useEffect(() => {
    if (!userTranscript || photoState !== 'none') return;
    if (hasPhotoTrigger(userTranscript, 'user')) {
      setPhotoState('choosing_source');
    }
  }, [userTranscript, photoState]);

  // Pause mic when actively using camera/library so AI waits.
  // Keep mic on during 'choosing_source' so user can verbally decline.
  useEffect(() => {
    if (photoState === 'capturing_camera' || photoState === 'selecting_library' || photoState === 'processing') {
      pauseMic();
    } else {
      resumeMic();
    }
  }, [photoState, pauseMic, resumeMic]);

  // Detect verbal photo decline while chooser is showing
  useEffect(() => {
    if (photoState !== 'choosing_source' || !userTranscript) return;
    const lower = userTranscript.toLowerCase();
    if (
      lower.includes("don't want") ||
      lower.includes("no photo") ||
      lower.includes("no picture") ||
      lower.includes("can't take") ||
      lower.includes("skip") ||
      lower.includes("not right now") ||
      lower.includes("maybe later") ||
      lower.includes("no thanks") ||
      lower.includes("never mind") ||
      lower.includes("without a photo") ||
      lower.includes("without photo")
    ) {
      console.log('[VoiceLoop] User declined photo verbally');
      setPhotoState('none');
    }
  }, [userTranscript, photoState]);

  // Detect garden walk wrap-up — auto-show summary when AI says "happy gardening"
  const wrapUpDetectedRef = useRef(false);
  const wrapUpTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (appState !== 'active' || wrapUpDetectedRef.current) return;

    // Check ALL assistant messages for "happy gardening" phrase
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;

      const lower = msg.content.toLowerCase();
      // Check for various wrap-up phrases
      if (lower.includes('happy gardening') ||
          lower.includes('happygardening') ||
          (lower.includes('happy') && lower.includes('garden'))) {

        console.log('[VoiceLoop] 🌟 HAPPY GARDENING detected in message:', msg.content);
        wrapUpDetectedRef.current = true;

        // Clear any existing timer
        if (wrapUpTimerRef.current) {
          clearTimeout(wrapUpTimerRef.current);
        }

        // Set timer
        wrapUpTimerRef.current = setTimeout(() => {
          console.log('[VoiceLoop] Transitioning to summary...');
          disconnect();
          stopAmbient();
          setAppState('summary');
          setVolume(0);
        }, 2000);

        break; // Found it, stop checking
      }
    }
  }, [messages, appState, disconnect, stopAmbient]);

  // Reset wrap-up flag when starting new walk
  useEffect(() => {
    if (appState === 'idle') {
      wrapUpDetectedRef.current = false;
      if (wrapUpTimerRef.current) {
        clearTimeout(wrapUpTimerRef.current);
        wrapUpTimerRef.current = null;
      }
    }
  }, [appState]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (wrapUpTimerRef.current) {
        clearTimeout(wrapUpTimerRef.current);
      }
    };
  }, []);

  // Compute current walk stage from message transcripts
  const currentStage = messages.length > 0 ? detectStageFromMessages(messages) : ('start' as JourneyStage);

  // Debug logging
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[Stage Detection] Current stage:', currentStage, '| Messages:', messages.length);
      const lastMsg = messages[messages.length - 1];
      console.log('[Stage Detection] Last message:', lastMsg.role, ':', lastMsg.content.substring(0, 100));
    }
  }, [currentStage, messages]);

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

  // Handle error state
  useEffect(() => {
    if (geminiError && appState === 'connecting') {
      setAppState('error');
      stopAmbient();
    }
  }, [geminiError, appState, stopAmbient]);

  const handleStart = async () => {
    setAppState('connecting');
    setErrorMsg(null);
    prevStageRef.current = 'start';

    try {
      startAmbient();
      await connect();
      // appState will be set to 'active' by the onConnected callback
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setAppState('error');
      stopAmbient();
    }
  };

  const handleEnd = () => {
    disconnect();
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
    setPhotoState('none');
  };

  const handleCameraSelect = () => {
    setPhotoState('capturing_camera');
  };

  const handleLibrarySelect = () => {
    setPhotoState('selecting_library');
  };

  const handlePhotoCapture = useCallback(
    (imageData: string) => {
      console.log('[VoiceLoop] Photo captured, size:', imageData?.length || 0);
      setPhotoState('none');
      sendImage(imageData, 'Here is the photo of my plant. What do you see?');
    },
    [sendImage]
  );

  const handlePhotoCancel = () => {
    setPhotoState('none');
  };

  return (
    <div className="relative w-full h-dvh bg-stone-900 overflow-hidden">
      <Visualizer volume={volume} isActive={appState === 'active'} />

      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/80 via-transparent to-stone-900/90 pointer-events-none z-0" />

      {/* IDLE */}
      {appState === 'idle' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-8 px-6 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-green-800 rounded-full flex items-center justify-center shadow-2xl shadow-green-900/50">
            <svg className="w-12 h-12 text-green-200" fill="currentColor" viewBox="0 0 64 64">
              <path d="M32 48c0-8-6-14-14-14-4 0-7.5 1.5-10 4 0 0 3-14 14-14 6 0 10 4 10 10v14z" />
              <path d="M32 48c0-8 6-14 14-14 4 0 7.5 1.5 10 4 0 0-3-14-14-14-6 0-10 4-10 10v14z" />
              <path d="M32 48L32 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-light text-stone-200 mb-2">Gardening Whisperer</h1>
            <p className="text-stone-400 max-w-xs mx-auto">An immersive, voice-first guide for your plants</p>
          </div>
          <button
            onClick={handleStart}
            className="group relative flex items-center justify-center w-20 h-20 bg-green-600 rounded-full hover:bg-green-500 transition-all duration-300 shadow-xl hover:shadow-green-500/30"
          >
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" style={{ shapeRendering: 'geometricPrecision' }}>
              <polygon points="8,5 19,12 8,19" fill="currentColor" />
            </svg>
            <span className="absolute -bottom-12 text-sm text-stone-500 font-medium tracking-wide">START WALK</span>
          </button>
        </div>
      )}

      {/* CONNECTING */}
      {appState === 'connecting' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
          <p className="mt-4 text-stone-400 tracking-wider text-sm">ENTERING THE GARDEN...</p>
        </div>
      )}

      {/* ACTIVE */}
      {appState === 'active' && (
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Header with live indicator */}
          <div className="absolute top-0 w-full p-6 flex justify-between items-start" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isSpeaking ? 'bg-blue-500 animate-pulse' : isListening ? 'bg-green-500 animate-pulse' : 'bg-stone-500'
                }`}
              />
              <span className="text-xs font-bold tracking-widest text-stone-500 uppercase">
                {isSpeaking ? 'AI Speaking...' : isListening ? 'Listening...' : isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Garden Journey Visual */}
          <div className="flex-1 flex items-center justify-center">
            <GardenJourney currentStage={currentStage} isWalking={isWalking} />
          </div>

          {/* Live transcript */}
          {(userTranscript || aiTranscript) && (
            <div className="absolute left-0 w-full flex justify-center px-6" style={{ top: 'calc(5rem + env(safe-area-inset-top))' }}>
              <div className="max-w-[85%] p-3 rounded-2xl bg-stone-800/90 text-stone-300 border border-stone-700/50 backdrop-blur-sm">
                {userTranscript && (
                  <p className="text-sm leading-relaxed">
                    <span className="text-stone-500 text-xs">You: </span>
                    {userTranscript}
                  </p>
                )}
                {aiTranscript && (
                  <p className="text-sm leading-relaxed mt-1">
                    <span className="text-green-500 text-xs">Gardener: </span>
                    {aiTranscript}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Hands-free indicator */}
          {isListening && !isSpeaking && (
            <div className="absolute left-0 w-full flex flex-col items-center gap-4 px-6" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
              <div className="flex items-center gap-2 text-green-500">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-bold uppercase tracking-wide">Listening — just speak</span>
              </div>
            </div>
          )}

          {/* Speaking indicator */}
          {isSpeaking && (
            <div className="absolute left-0 w-full flex flex-col items-center gap-4 px-6" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
              <div className="flex items-center gap-3 text-blue-400">
                <div className="flex gap-1">
                  <div className="w-1.5 h-4 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-4 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm font-bold uppercase tracking-wide">AI Speaking...</span>
              </div>
            </div>
          )}


          {/* End Walk Button */}
          <div className="absolute right-6 z-20 flex flex-col gap-4" style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleEnd}
                className="w-14 h-14 bg-red-500/20 active:bg-red-500/40 border border-red-500/50 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300"
              >
                <svg className="w-6 h-6 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="text-xs text-stone-500 font-medium">END WALK</span>
            </div>
          </div>

          {/* Photo button - always available */}
          <div className="absolute left-6 z-20" style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setPhotoState('choosing_source')}
                className="w-14 h-14 bg-green-500/20 active:bg-green-500/40 border border-green-500/50 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300"
              >
                <svg className="w-6 h-6 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <span className="text-xs text-stone-500 font-medium">PHOTO</span>
            </div>
          </div>

          {/* Photo UI States */}
          {photoState === 'choosing_source' && (
            <PhotoChooser onCameraSelect={handleCameraSelect} onLibrarySelect={handleLibrarySelect} onCancel={handlePhotoCancel} />
          )}

          {photoState === 'capturing_camera' && <CameraCapture onCapture={handlePhotoCapture} onCancel={handlePhotoCancel} />}

          {photoState === 'selecting_library' && <PhotoLibrary onSelect={handlePhotoCapture} onCancel={handlePhotoCancel} />}

          {photoState === 'processing' && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
                <p className="text-lg">Analyzing your plant...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {appState === 'summary' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 animate-in slide-in-from-bottom duration-500">
          <div className="w-full max-w-md bg-stone-800/50 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-8 shadow-2xl">
            <button
              onClick={handleReset}
              className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-stone-700/50 active:bg-stone-600/80 text-stone-400 active:text-stone-200 transition-all duration-200"
              aria-label="Close summary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-900/50 rounded-xl text-green-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-stone-100">Garden Walk Complete</h2>
                <p className="text-sm text-stone-400">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto bg-stone-900/50 rounded-xl p-4 mb-6 border border-stone-800 text-sm text-stone-300 leading-relaxed selectable-text">
              {messages.length > 0 ? (
                messages.map((m, i) => (
                  <div key={i} className="mb-3">
                    <span className={`font-bold text-xs uppercase ${m.role === 'assistant' ? 'text-green-500' : 'text-stone-500'}`}>
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
                className="flex-1 py-3 px-4 bg-stone-700 active:bg-stone-600 rounded-xl font-medium text-stone-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Copy Summary
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 px-4 bg-green-700 active:bg-green-600 rounded-xl font-medium text-white transition-colors"
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
          <p className="text-stone-400 mb-6 max-w-xs">{errorMsg || 'Something went wrong in the garden.'}</p>
          <button onClick={handleReset} className="px-6 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-200">
            Return Home
          </button>
        </div>
      )}
    </div>
  );
}
