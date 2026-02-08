'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useAmbientSound } from '@/hooks/useAmbientSound';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { formatCalendarEvent, createCalendarEvent } from '@/lib/googleCalendar';
import { detectStageFromMessages, STAGE_ORDER } from '@/lib/stageDetection';
import { generateSummaryData } from '@/lib/summaryGeneration';
import { getBackgroundGradient } from '@/lib/backgroundGradient';
import { hasPhotoTrigger } from '@/lib/photoTrigger';
import { Visualizer } from './Visualizer';
import type { JourneyStage } from './GardenJourney';
import dynamic from 'next/dynamic';

// Code-split conditional components — only loaded when their UI state is active
const GardenJourney = dynamic(
  () => import('./GardenJourney').then(mod => ({ default: mod.GardenJourney })),
  { ssr: false }
);
const PhotoChooser = dynamic(() => import('./PhotoChooser'), { ssr: false });
const CameraCapture = dynamic(
  () => import('./CameraCapture').then(mod => ({ default: mod.CameraCapture })),
  { ssr: false }
);
const PhotoLibrary = dynamic(() => import('./PhotoLibrary'), { ssr: false });

type AppState = 'idle' | 'connecting' | 'active' | 'summary' | 'error';
type PhotoState = 'none' | 'choosing_source' | 'capturing_camera' | 'selecting_library' | 'processing';

// SummaryData type and business logic functions are now in lib/ modules:
// - lib/plantExtraction.ts
// - lib/stageDetection.ts (STAGE_ORDER, detectStageFromMessages, extractStageSummary, etc.)
// - lib/summaryGeneration.ts (SummaryData, generateSummaryData, getCareRecommendations)
// - lib/backgroundGradient.ts (getBackgroundGradient)
// - lib/photoTrigger.ts (hasPhotoTrigger)

export function VoiceLoop() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [volume, setVolume] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<PhotoState>('none');
  const [isWalking, setIsWalking] = useState(false);
  const [walkCompleted, setWalkCompleted] = useState(false);
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [calendarState, setCalendarState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const prevStageRef = useRef<JourneyStage>('start');

  const { isConnected: isCalendarConnected, accessToken: calendarToken, isGISReady, signIn: calendarSignIn, signOut: calendarSignOut } = useGoogleCalendar();

  const { startAmbient, stopAmbient, duck, unduck } = useAmbientSound({
    volume: 0.12,
    duckingVolume: 0.04,
  });

  const {
    connect,
    disconnect,
    sendText,
    pauseMic,
    resumeMic,
    isConnected,
    isListening,
    isSpeaking,
    userTranscript,
    aiTranscript,
    messages,
    messagesRef,
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
      console.log('[VoiceLoop] 🌟 Walk complete signal received from server');
      setWalkCompleted(true);
      setTimeout(() => {
        console.log('[VoiceLoop] Transitioning to summary now');
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

  // Decay volume over time — only while actively walking
  useEffect(() => {
    if (appState !== 'active') return;
    const interval = setInterval(() => {
      setVolume((v) => Math.max(0.1, v * 0.95));
    }, 100);
    return () => clearInterval(interval);
  }, [appState]);

  // hasPhotoTrigger is now imported from @/lib/photoTrigger

  // Speak acknowledgment when photo chooser appears
  const speakPhotoPrompt = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('You can go ahead and take a photo or upload a photo now');
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Track whether a photo trigger was detected but waiting for speech to end
  const pendingPhotoTriggerRef = useRef(false);

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
        console.log('[VoiceLoop] Photo trigger detected in completed message:', msg.content.slice(0, 80));
        if (source === 'ai' && isSpeaking) {
          // AI is still speaking — defer showing the modal until audio finishes
          pendingPhotoTriggerRef.current = true;
        } else {
          setPhotoState('choosing_source');
          speakPhotoPrompt();
        }
        break;
      }
    }
  }, [messages, photoState, isSpeaking, speakPhotoPrompt]);

  // Show photo UI once AI finishes speaking (deferred from above)
  useEffect(() => {
    if (!isSpeaking && pendingPhotoTriggerRef.current && photoState === 'none') {
      pendingPhotoTriggerRef.current = false;
      console.log('[VoiceLoop] AI finished speaking — showing photo chooser');
      setPhotoState('choosing_source');
      speakPhotoPrompt();
    }
  }, [isSpeaking, photoState, speakPhotoPrompt]);

  // Also detect from streaming AI transcripts (faster response)
  useEffect(() => {
    if (!aiTranscript || photoState !== 'none') return;
    if (hasPhotoTrigger(aiTranscript, 'ai')) {
      // Mark pending — the completed messages effect or the isSpeaking watcher will fire it
      pendingPhotoTriggerRef.current = true;
    }
  }, [aiTranscript, photoState]);

  useEffect(() => {
    if (!userTranscript || photoState !== 'none') return;
    if (hasPhotoTrigger(userTranscript, 'user')) {
      setPhotoState('choosing_source');
      speakPhotoPrompt();
    }
  }, [userTranscript, photoState, speakPhotoPrompt]);

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

  // Note: Summary auto-appears when AI says "happy gardening"
  // Detection happens server-side in gemini-live-proxy.js which sends a 'walk_complete' message
  // This triggers the onWalkComplete callback below

  // Stage only advances forward, never regresses — prevents icon flickering
  // when new AI responses temporarily lack stage-advancing keywords
  const [currentStage, setCurrentStage] = useState<JourneyStage>('start');

  useEffect(() => {
    if (walkCompleted) {
      setCurrentStage('complete');
      return;
    }

    // Detect stage from completed messages
    const stageFromMessages = messages.length > 0 ? detectStageFromMessages(messages) : 'start';

    // Also check live AI transcript for real-time advancement
    let detectedStage = stageFromMessages;
    if (aiTranscript && aiTranscript.length > 20) {
      const liveMessages = [
        ...messages,
        { role: 'assistant' as const, content: aiTranscript }
      ];
      const stageFromLive = detectStageFromMessages(liveMessages);
      const messageIdx = STAGE_ORDER.indexOf(stageFromMessages);
      const liveIdx = STAGE_ORDER.indexOf(stageFromLive);
      detectedStage = liveIdx > messageIdx ? stageFromLive : stageFromMessages;
    }

    // Only advance — never go back
    setCurrentStage(prev => {
      const prevIdx = STAGE_ORDER.indexOf(prev);
      const detectedIdx = STAGE_ORDER.indexOf(detectedStage);
      if (detectedIdx > prevIdx) {
        console.log('[Stage] Advancing:', prev, '->', detectedStage);
        return detectedStage;
      }
      return prev;
    });
  }, [messages, aiTranscript, walkCompleted]);

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
  // Show error screen when connection fails or drops mid-walk
  useEffect(() => {
    if (geminiError && (appState === 'connecting' || appState === 'active')) {
      setErrorMsg(geminiError);
      setAppState('error');
      stopAmbient();
    }
  }, [geminiError, appState, stopAmbient]);

  const handleStart = async () => {
    if (appState !== 'idle') return; // Prevent double-tap
    setAppState('connecting');
    setErrorMsg(null);
    setCurrentStage('start');
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
    const backup = messagesRef.current ?? [];
    const allMsgs = messages.length >= backup.length ? messages : backup;
    const summary = allMsgs
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(summary);
  };

  const handleReset = () => {
    setAppState('idle');
    setVolume(0);
    setPhotoState('none');
    setCopiedSummary(false);
    setWalkCompleted(false);
    setCurrentStage('start');
  };

  const handleCameraSelect = () => {
    setPhotoState('capturing_camera');
  };

  const handleLibrarySelect = () => {
    setPhotoState('selecting_library');
  };

  const handlePhotoCapture = useCallback(
    async (imageData: string) => {
      console.log('[VoiceLoop] Photo captured, size:', imageData?.length || 0);

      setPhotoState('processing');

      // Build conversation context for Gemini 3
      const backup = messagesRef.current ?? [];
      const allMsgs = messages.length >= backup.length ? messages : backup;
      const conversationContext = allMsgs
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      try {
        const res = await fetch('/api/analyze-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData, conversationContext }),
        });

        const data = await res.json();

        if (data.success && data.analysis) {
          console.log('[VoiceLoop] Photo analysis received:', data.analysis.slice(0, 100));
          sendText(`[Photo analysis] ${data.analysis}`);
        } else {
          console.warn('[VoiceLoop] Photo analysis failed:', data.error);
          sendText('I tried to analyze the photo but had trouble. Can you describe what you see instead?');
        }
      } catch (err) {
        console.error('[VoiceLoop] Photo analysis fetch error:', err);
        sendText('I tried to analyze the photo but had trouble. Can you describe what you see instead?');
      }

      setPhotoState('none');
    },
    [sendText, messages, messagesRef]
  );

  const handlePhotoCancel = () => {
    setPhotoState('none');
  };

  const backgroundGradient = getBackgroundGradient(currentStage);

  return (
    <div className="relative w-full h-dvh bg-stone-900 overflow-hidden">
      <Visualizer volume={volume} isActive={appState === 'active'} />

      {/* Dynamic background gradient based on journey progress */}
      <div
        className={`absolute inset-0 bg-gradient-to-b pointer-events-none z-0 transition-all duration-1000 ${backgroundGradient}`}
      />


      {/* IDLE */}
      {appState === 'idle' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-8 px-6 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-green-800 rounded-full flex items-center justify-center shadow-2xl shadow-green-900/50">
            <svg className="w-12 h-12 text-green-100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 9.00006L16 5.00006M12 14.5001L15 11.5001M18.5 8.00006L16.875 9.62506M12 19.5001L13.875 17.6251M19.5 12.0001L15.75 15.7501" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 22C16.4183 22 20 18.3541 20 13.8567C20 9.39453 17.4467 4.18759 13.4629 2.32555C12.9986 2.10852 12.4993 2 12 2M12 22C7.58172 22 4 18.3541 4 13.8567C4 12.2707 4.32258 10.5906 4.91731 9M12 22V2M12 2C11.5007 2 11.0014 2.10852 10.5371 2.32555C8.93605 3.07388 7.56606 4.36246 6.5 5.92583" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-light text-stone-200 mb-2">Gardening Whisperer</h1>
            <p className="text-stone-400 max-w-xs mx-auto">An immersive, voice-first guide for your plants</p>
          </div>
          <button
            onClick={handleStart}
            aria-label="Start garden walk"
            className="group relative flex items-center justify-center w-20 h-20 bg-green-600 rounded-full hover:bg-green-500 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-green-500/50 active:scale-95"
          >
            <svg className="w-12 h-12 text-white transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24" style={{ shapeRendering: 'geometricPrecision' }}>
              <polygon points="8,5 19,12 8,19" fill="currentColor" />
            </svg>
            <span className="absolute -bottom-12 text-sm text-stone-400 font-medium tracking-wide">START WALK</span>
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
            <div className="flex items-center gap-2" aria-live="polite">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isSpeaking
                    ? 'bg-blue-500 speaking-indicator'
                    : isListening
                    ? 'bg-green-500 listening-indicator'
                    : 'bg-stone-500'
                }`}
              />
              <span className={`text-xs font-semibold tracking-widest uppercase transition-all duration-300 ${
                isSpeaking
                  ? 'text-blue-400'
                  : isListening
                  ? 'text-green-400'
                  : 'text-stone-500'
              }`}>
                {isSpeaking ? 'AI Speaking...' : isListening ? 'Listening...' : isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Garden Journey Visual */}
          <div className="flex-1 flex items-center justify-center pb-40">
            <GardenJourney currentStage={currentStage} isWalking={isWalking} />
          </div>

          {/* End Walk Button - Bottom Center */}
          <div className="absolute left-0 right-0 bottom-0 z-20 flex justify-center" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex flex-col items-center gap-2 group">
              <button
                onClick={handleEnd}
                aria-label="End garden walk"
                className="w-14 h-14 bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 border border-red-500/50 hover:border-red-500/70 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 active:scale-95 shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
              >
                <svg className="w-6 h-6 text-red-300 transition-transform duration-200 group-hover:rotate-90 group-active:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="text-xs text-stone-400 font-semibold transition-colors duration-200 group-hover:text-stone-300">END WALK</span>
            </div>
          </div>

          {/* Photo UI States */}
          {photoState === 'choosing_source' && (
            <PhotoChooser onCameraSelect={handleCameraSelect} onLibrarySelect={handleLibrarySelect} onCancel={handlePhotoCancel} />
          )}

          {photoState === 'capturing_camera' && <CameraCapture onCapture={handlePhotoCapture} onCancel={handlePhotoCancel} />}

          {photoState === 'selecting_library' && <PhotoLibrary onSelect={handlePhotoCapture} onCancel={handlePhotoCancel} onError={(msg) => console.error('[PhotoLibrary]', msg)} />}

          {photoState === 'processing' && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              className="animate-in fade-in duration-200"
            >
              <div style={{ textAlign: 'center', color: '#fff' }} className="backdrop-blur-sm bg-stone-900/50 rounded-3xl p-8 border border-stone-700/50">
                <div className="animate-spin rounded-full h-16 w-16 border-b-3 border-green-500 mx-auto mb-4" />
                <p className="text-xl font-medium text-stone-100 mb-2">Uploading photo...</p>
                <p className="text-sm text-stone-400">Preparing for analysis</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {appState === 'summary' && (() => {
        // Use whichever source has more messages — backup ref guards against state loss
        const backup = messagesRef.current ?? [];
        const allMessages = messages.length >= backup.length ? messages : backup;
        const summaryData = generateSummaryData(allMessages);
        return (
        <div className="relative z-10 flex flex-col items-center justify-start h-full overflow-y-auto px-4 animate-in slide-in-from-bottom duration-500" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <div className="w-full max-w-md">
            {/* Close button - fixed position */}
            <button
              onClick={handleReset}
              className="absolute top-6 right-6 w-11 h-11 flex items-center justify-center rounded-full bg-stone-800/80 backdrop-blur-sm active:bg-stone-700 text-stone-400 active:text-stone-200 transition-all duration-200 z-20"
              aria-label="Close summary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Plant Hero Image Card */}
            <div className="bg-gradient-to-br from-green-800/30 to-green-900/20 backdrop-blur-xl border border-green-700/30 rounded-3xl p-6 mb-6 text-center shadow-2xl">
              {/* Garden planting illustration */}
              <div className="w-48 h-48 mx-auto mb-4 bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-2xl flex items-center justify-center p-6">
                <svg className="w-full h-full" viewBox="0 0 100 100" fill="#22c55e" opacity="0.8">
                  <path d="M92.8,82.1c-0.3-0.2-0.6-0.4-0.9-0.6c-0.3-0.2-0.8-0.7-1.2-1.2c-0.8-0.9-1.7-1.9-3-2.4c-0.9-0.3-1.9-0.2-2.8-0.1    c-0.7,0.1-1.4,0.2-2,0.1c-0.5-0.1-1-0.5-1.6-0.9c-0.8-0.6-1.8-1.2-2.9-1.3c-1-0.1-1.9,0.2-2.8,0.5c-0.7,0.2-1.4,0.5-1.9,0.4    c-0.5,0-1.1-0.3-1.8-0.7C71,75.5,70.1,75,69,75c-1.1,0-2,0.5-2.9,0.9C66,75.9,66,76,65.9,76c1.4-1.7,2.7-3.5,3.7-5.4l3.3-6.4    c0.1-0.2,0.1-0.5,0.1-0.8s-0.3-0.5-0.5-0.6l-6.2-3.2l7.4-14.2c0.1-0.3,0.4-0.5,0.7-0.5l3-0.5c0.9-0.2,1.7-0.7,2.2-1.6l3.2-6.2    c0.4-0.7,0.4-1.5,0.2-2.3c-0.2-0.8-0.8-1.4-1.5-1.8L72.5,28c-0.7-0.4-1.5-0.4-2.3-0.2c-0.8,0.2-1.4,0.8-1.8,1.5l-3.2,6.2    c-0.4,0.8-0.4,1.8,0,2.7l1.3,2.7c0.1,0.3,0.1,0.6,0,0.9l-7.4,14.2l-6.2-3.2c-0.5-0.3-1.1-0.1-1.3,0.4l-3.3,6.4    c-2.9,5.6-3.8,12.1-2.7,18.4c-0.2,0-0.5,0-0.7-0.1c-0.5-0.1-1-0.5-1.6-0.9c-0.8-0.6-1.8-1.2-2.9-1.3c-1-0.1-1.9,0.2-2.8,0.5    c-0.7,0.2-1.3,0.5-1.9,0.4c-0.5,0-1.1-0.3-1.8-0.7c-0.3-0.1-0.6-0.3-0.9-0.4V60.4l3.4-3.4c1.1-0.1,5.4-0.8,7.3-4.8c0,0,0,0,0,0    c2.1-4.2,1-11.1,0.9-11.4c-0.1-0.3-0.3-0.6-0.5-0.7c-0.3-0.1-0.6-0.1-0.9,0c-0.3,0.1-6.4,3.4-8.5,7.6c-1.7,3.3-0.6,6.6,0.1,8    L33,57.6V42.8c1.6-0.7,2.6-2.9,3-5.1c1.4,1,3.1,1.7,4.5,1.7c0.8,0,1.5-0.2,2.1-0.8c0,0,0,0,0,0c1.5-1.5,0.6-4.4-0.9-6.6    c2.6-0.5,5.3-1.9,5.3-4c0-2.1-2.7-3.5-5.3-4c1.5-2.2,2.4-5.1,0.9-6.6c-1.5-1.5-4.4-0.6-6.6,0.9c-0.5-2.6-1.9-5.3-4-5.3    s-3.5,2.7-4,5.3c-2.2-1.5-5.1-2.4-6.6-0.9c-1.5,1.5-0.6,4.4,0.9,6.6c-2.6,0.5-5.3,1.9-5.3,4s2.7,3.5,5.3,4    c-1.5,2.2-2.4,5.1-0.9,6.6c0.5,0.5,1.3,0.8,2.1,0.8c1.4,0,3.1-0.7,4.5-1.7c0.4,2.2,1.5,4.4,3,5.1v19.8l-1.8-1.8    c0.7-1.5,1.7-4.7,0.1-8c-2.1-4.2-8.2-7.5-8.5-7.6c-0.3-0.2-0.6-0.2-0.9,0c-0.3,0.1-0.5,0.4-0.5,0.7c0,0.3-1.1,7.2,0.9,11.4    c0,0,0,0,0,0c2,3.9,6.3,4.6,7.3,4.8l3.4,3.4V75c-1.1,0-2,0.5-2.9,0.9c-0.6,0.3-1.3,0.6-1.8,0.7c-0.6,0-1.2-0.2-1.9-0.4    c-0.9-0.3-1.8-0.6-2.8-0.5c-1.1,0.2-2,0.8-2.9,1.3c-0.6,0.4-1.2,0.8-1.6,0.9c-0.6,0.1-1.3,0-2-0.1c-0.9-0.1-1.9-0.3-2.8,0.1    c-1.3,0.5-2.2,1.5-3,2.4c-0.4,0.5-0.8,0.9-1.2,1.2c-0.3,0.2-0.6,0.4-0.9,0.6C5.6,83.1,4,84.1,4,86c0,0.6,0.4,1,1,1h38h14h38    c0.6,0,1-0.4,1-1C96,84.2,94.4,83.1,92.8,82.1z M36.5,48.6c1.3-2.6,4.5-4.8,6.3-6c0.2,2.1,0.3,6.1-0.9,8.7v0    c-1.3,2.6-4,3.4-5.3,3.6C36.1,53.8,35.3,51.2,36.5,48.6z M22.1,56.3L22.1,56.3c-1.3-2.6-1.1-6.6-0.9-8.7c1.8,1.1,5.1,3.4,6.3,6    c1.3,2.6,0.4,5.2-0.1,6.3C26.1,59.7,23.3,58.9,22.1,56.3z M33.4,31c-0.1,0.1-0.2,0.1-0.3,0.1c-0.7,0.2-1.4,0.2-2.2,0    c-0.1,0-0.2-0.1-0.3-0.1c0,0,0,0,0,0c0,0,0,0,0,0c-0.7-0.3-1.2-0.8-1.5-1.5c0,0,0,0,0,0c0,0,0,0,0,0c-0.1-0.1-0.1-0.2-0.1-0.3    c0,0,0,0,0,0c-0.1-0.4-0.2-0.7-0.2-1.1s0.1-0.7,0.2-1.1c0-0.1,0.1-0.2,0.1-0.3c0,0,0,0,0,0c0,0,0,0,0,0c0.3-0.7,0.8-1.2,1.5-1.5    c0,0,0,0,0,0c0,0,0,0,0,0c0.1-0.1,0.2-0.1,0.3-0.1c0.7-0.2,1.4-0.2,2.2,0c0.1,0,0.2,0.1,0.3,0.1c0,0,0,0,0,0c0,0,0,0,0,0    c0.7,0.3,1.2,0.8,1.5,1.5c0,0,0,0,0,0c0,0,0,0,0,0c0.1,0.1,0.1,0.2,0.1,0.3c0.1,0.4,0.2,0.7,0.2,1.1s-0.1,0.7-0.2,1.1    c0,0.1-0.1,0.2-0.1,0.3c0,0,0,0,0,0c0,0,0,0,0,0C34.6,30.1,34.1,30.6,33.4,31C33.4,31,33.4,31,33.4,31C33.4,31,33.4,31,33.4,31z     M41.2,37.2L41.2,37.2c-0.5,0.5-3-0.1-5-1.8c0-0.1,0-0.1,0-0.2c0-0.2,0-0.5-0.1-0.7c0-0.1,0-0.2,0-0.3c0-0.2-0.1-0.4-0.1-0.5    c0-0.1,0-0.2-0.1-0.3c-0.1-0.2-0.1-0.3-0.2-0.5c0-0.1,0-0.1-0.1-0.2c-0.1-0.2-0.2-0.4-0.3-0.6c0,0,0,0,0,0    c0.3-0.2,0.5-0.4,0.7-0.7c0,0,0,0,0,0c0.2,0.1,0.4,0.2,0.6,0.3c0.1,0,0.1,0,0.2,0.1c0.2,0.1,0.3,0.1,0.5,0.2c0.1,0,0.2,0,0.3,0.1    c0.2,0,0.3,0.1,0.5,0.1c0.1,0,0.2,0,0.3,0c0.2,0,0.4,0,0.7,0.1c0.1,0,0.1,0,0.2,0C41.1,34.2,41.7,36.6,41.2,37.2z M45,28    c0,0.8-2.4,2.2-5.2,2.2c0,0-0.1,0-0.1,0c0,0-0.1,0-0.1,0c-0.3,0-0.6,0-0.9-0.1c-0.1,0-0.2,0-0.2,0c-0.2,0-0.4-0.1-0.5-0.1    c-0.1,0-0.2,0-0.2-0.1c-0.2-0.1-0.3-0.1-0.4-0.2c0,0-0.1-0.1-0.1-0.1c0,0,0,0,0,0c0.2-0.5,0.3-1.1,0.3-1.6c0-0.5-0.1-1.1-0.3-1.6    c0,0,0,0,0,0c0,0,0.1-0.1,0.1-0.1c0.1-0.1,0.3-0.1,0.4-0.2c0.1,0,0.1-0.1,0.2-0.1c0.2,0,0.3-0.1,0.5-0.1c0.1,0,0.2,0,0.2,0    c0.3,0,0.6-0.1,0.9-0.1c0,0,0.1,0,0.1,0c0,0,0.1,0,0.1,0C42.6,25.8,45,27.2,45,28z M41.2,18.8c0.5,0.5-0.1,3-1.8,5    c-0.1,0-0.2,0-0.2,0c-0.2,0-0.5,0-0.7,0.1c-0.1,0-0.2,0-0.3,0c-0.2,0-0.4,0.1-0.5,0.1c-0.1,0-0.2,0-0.3,0.1    c-0.2,0.1-0.3,0.1-0.5,0.2c-0.1,0-0.1,0-0.2,0.1c-0.2,0.1-0.4,0.2-0.6,0.3c0,0,0,0,0,0c-0.2-0.3-0.4-0.5-0.7-0.7c0,0,0,0,0,0    c0.1-0.2,0.2-0.4,0.3-0.6c0-0.1,0-0.1,0.1-0.2c0.1-0.2,0.1-0.3,0.2-0.5c0-0.1,0-0.2,0.1-0.3c0-0.2,0.1-0.3,0.1-0.5    c0-0.1,0-0.2,0-0.3c0-0.2,0-0.4,0.1-0.7c0-0.1,0-0.1,0-0.2C38.2,18.9,40.6,18.3,41.2,18.8z M32,15c0.8,0,2.2,2.4,2.2,5.2    c0,0,0,0.1,0,0.1c0,0,0,0.1,0,0.1c0,0.3,0,0.6-0.1,0.9c0,0.1,0,0.2,0,0.2c0,0.2-0.1,0.4-0.1,0.5c0,0.1,0,0.2-0.1,0.2    c-0.1,0.2-0.1,0.3-0.2,0.4c0,0,0,0.1-0.1,0.1c0,0,0,0,0,0c-0.5-0.2-1.1-0.3-1.6-0.3c-0.5,0-1.1,0.1-1.6,0.3c0,0,0,0,0,0    c0,0-0.1-0.1-0.1-0.1c-0.1-0.1-0.2-0.3-0.2-0.4c0-0.1-0.1-0.1-0.1-0.2c0-0.2-0.1-0.3-0.1-0.5c0-0.1,0-0.2,0-0.2    c0-0.3-0.1-0.6-0.1-0.9c0,0,0-0.1,0-0.1c0,0,0-0.1,0-0.1C29.8,17.4,31.2,15,32,15z M22.8,18.8c0.5-0.5,3,0.1,5,1.8    c0,0.1,0,0.1,0,0.2c0,0.2,0,0.5,0.1,0.7c0,0.1,0,0.2,0,0.3c0,0.2,0.1,0.4,0.1,0.5c0,0.1,0,0.2,0.1,0.3c0.1,0.2,0.1,0.3,0.2,0.5    c0,0.1,0,0.1,0.1,0.2c0.1,0.2,0.2,0.4,0.3,0.6c0,0,0,0,0,0c-0.3,0.2-0.5,0.4-0.7,0.7c0,0,0,0,0,0c-0.2-0.1-0.4-0.2-0.6-0.3    c-0.1,0-0.1,0-0.2-0.1c-0.2-0.1-0.3-0.1-0.5-0.2c-0.1,0-0.2,0-0.3-0.1c-0.2,0-0.3-0.1-0.5-0.1c-0.1,0-0.2,0-0.3,0    c-0.2,0-0.4,0-0.7-0.1c-0.1,0-0.1,0-0.2,0C22.9,21.8,22.3,19.4,22.8,18.8z M19,28c0-0.8,2.4-2.2,5.2-2.2c0,0,0.1,0,0.1,0    c0,0,0.1,0,0.1,0c0.3,0,0.6,0,0.9,0.1c0.1,0,0.2,0,0.2,0c0.2,0,0.4,0.1,0.5,0.1c0.1,0,0.2,0,0.2,0.1c0.2,0.1,0.3,0.1,0.4,0.2    c0,0,0.1,0.1,0.1,0.1c0,0,0,0,0,0c-0.2,0.5-0.3,1.1-0.3,1.6s0.1,1.1,0.3,1.6c0,0,0,0,0,0c0,0-0.1,0.1-0.1,0.1    c-0.1,0.1-0.3,0.1-0.4,0.2c-0.1,0-0.1,0.1-0.2,0.1c-0.2,0-0.3,0.1-0.5,0.1c-0.1,0-0.2,0-0.2,0c-0.3,0-0.6,0.1-0.9,0.1    c0,0-0.1,0-0.1,0c0,0-0.1,0-0.1,0C21.4,30.2,19,28.8,19,28z M22.8,37.2c-0.5-0.5,0.1-3,1.8-5c0.1,0,0.2,0,0.2,0    c0.2,0,0.5,0,0.7-0.1c0.1,0,0.2,0,0.3,0c0.2,0,0.4-0.1,0.5-0.1c0.1,0,0.2,0,0.3-0.1c0.2-0.1,0.3-0.1,0.5-0.2c0.1,0,0.1,0,0.2-0.1    c0.2-0.1,0.4-0.2,0.6-0.3c0,0,0,0,0,0c0.2,0.3,0.4,0.5,0.7,0.7c0,0,0,0,0,0c-0.1,0.2-0.2,0.4-0.3,0.6c0,0.1,0,0.1-0.1,0.2    c-0.1,0.2-0.1,0.3-0.2,0.5c0,0.1,0,0.2-0.1,0.3c0,0.2-0.1,0.3-0.1,0.5c0,0.1,0,0.2,0,0.3c0,0.2,0,0.4-0.1,0.7c0,0.1,0,0.1,0,0.2    C25.8,37.1,23.3,37.7,22.8,37.2z M29.8,35.8c0,0,0-0.1,0-0.1c0,0,0-0.1,0-0.1c0-0.3,0-0.6,0.1-0.9c0-0.1,0-0.2,0-0.2    c0-0.2,0.1-0.4,0.1-0.5c0-0.1,0-0.2,0.1-0.2c0.1-0.2,0.1-0.3,0.2-0.4c0,0,0-0.1,0.1-0.1c0,0,0,0,0,0c1.1,0.3,2.2,0.3,3.2,0    c0,0,0,0,0,0c0,0,0.1,0.1,0.1,0.1c0.1,0.1,0.2,0.3,0.2,0.4c0,0.1,0.1,0.1,0.1,0.2c0,0.2,0.1,0.3,0.1,0.5c0,0.1,0,0.2,0,0.2    c0,0.3,0.1,0.6,0.1,0.9c0,0,0,0.1,0,0.1c0,0,0,0.1,0,0.1C34.2,38.6,32.8,41,32,41S29.8,38.6,29.8,35.8z M60.9,56.9l7.4-14.2    c0.4-0.8,0.4-1.8,0-2.7L67,37.3c-0.1-0.3-0.1-0.6,0-0.9l3.2-6.2c0.1-0.2,0.3-0.4,0.6-0.5c0.3-0.1,0.5-0.1,0.8,0.1l8.9,4.6    c0.2,0.1,0.4,0.3,0.5,0.6c0.1,0.3,0.1,0.5-0.1,0.8l-3.2,6.2c-0.1,0.3-0.4,0.5-0.7,0.5l-3,0.5c-0.9,0.2-1.7,0.7-2.2,1.6l-7.4,14.2    l-1-0.5L60.9,56.9z M50,60.5l2.9-5.5l9.3,4.8l2.3,1.2c0,0,0,0,0,0l6.2,3.2l-2.9,5.6c-1.3,2.4-2.9,4.6-4.9,6.6    c-0.2-0.1-0.3-0.1-0.5-0.2c-0.9-0.3-1.8-0.6-2.8-0.5c-1.1,0.2-2,0.8-2.9,1.4c-0.6,0.4-1.2,0.8-1.6,0.9c-0.6,0.1-1.3,0-2-0.1    c-0.9-0.1-1.9-0.3-2.8,0.1c-0.1,0-0.2,0.1-0.3,0.2c-0.1,0-0.2-0.1-0.3-0.2c-0.7-0.3-1.4-0.2-2.1-0.2C46.4,71.9,47.3,65.8,50,60.5z     M43,85H6.5c0.4-0.4,1-0.8,1.8-1.3c0.3-0.2,0.6-0.4,1-0.6c0.5-0.4,1-0.9,1.5-1.5c0.7-0.8,1.4-1.6,2.2-1.9c0.5-0.2,1.1-0.1,1.8,0    c0.8,0.1,1.8,0.3,2.8,0c0.8-0.2,1.6-0.7,2.3-1.2c0.7-0.5,1.4-0.9,2-1c0.5-0.1,1.2,0.2,1.9,0.4c0.8,0.3,1.7,0.6,2.7,0.5    c0.9-0.1,1.7-0.5,2.5-0.9c0.7-0.4,1.4-0.7,2-0.7c0.6,0,1.3,0.3,2,0.7c0.8,0.4,1.6,0.8,2.5,0.9c1,0.1,1.9-0.3,2.7-0.5    c0.7-0.2,1.4-0.5,1.9-0.4c0.6,0.1,1.3,0.6,2,1c0.7,0.5,1.5,1,2.3,1.2c1,0.2,1.9,0.1,2.8,0c0.7-0.1,1.4-0.2,1.8,0    c0.8,0.3,1.5,1.1,2.2,1.9c0.5,0.6,1,1.1,1.5,1.5c0.3,0.2,0.6,0.4,1,0.6c0.8,0.5,1.4,0.9,1.8,1.3H43z M57.8,85    c-0.5-1.3-1.7-2.1-3.1-3c-0.3-0.2-0.6-0.4-0.9-0.6c-0.3-0.2-0.7-0.7-1.2-1.2c-0.2-0.2-0.3-0.4-0.5-0.6c0.2,0,0.5,0.1,0.7,0.1    c0.8,0.1,1.8,0.3,2.8,0c0.8-0.2,1.6-0.7,2.3-1.2c0.7-0.5,1.4-0.9,2-1c0.5-0.1,1.2,0.2,1.9,0.4c0.3,0.1,0.7,0.2,1,0.3c0,0,0,0,0,0    c0.5,0.1,1.1,0.3,1.7,0.2c0.9-0.1,1.7-0.5,2.5-0.9c0.7-0.4,1.4-0.7,2-0.7c0.6,0,1.3,0.3,2,0.7c0.8,0.4,1.6,0.8,2.5,0.9    c1,0.1,1.9-0.3,2.7-0.5c0.7-0.2,1.4-0.5,1.9-0.4c0.6,0.1,1.3,0.6,2,1c0.7,0.5,1.5,1,2.3,1.2c1,0.2,1.9,0.1,2.8,0    c0.7-0.1,1.4-0.2,1.8,0c0.8,0.3,1.5,1.1,2.2,1.9c0.5,0.6,1,1.1,1.5,1.5c0.3,0.2,0.7,0.4,1,0.7c0.8,0.5,1.4,0.9,1.8,1.3H57.8z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-100 mb-1">{summaryData.plantName} Plant</h2>
              <p className="text-sm text-green-300/70">Garden Walk Complete • {new Date().toLocaleDateString()}</p>
            </div>

            {/* Walk Summary - Icon Checklist */}
            <div className="bg-stone-800/50 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-stone-100 mb-4">What We Covered</h3>
              <div className="space-y-3">
                {/* Plant ID */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="20" y1="36" x2="20" y2="18" />
                      <path d="M20 24 Q12 20 10 12 Q18 14 20 24" />
                      <path d="M20 18 Q28 14 30 6 Q22 8 20 18" />
                      <path d="M10 36 Q20 34 30 36" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-200">Plant Identified</p>
                    <p className="text-xs text-stone-400 mt-0.5">{summaryData.plantIdentified}</p>
                  </div>
                </div>

                {/* Symptoms */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M12 9.00006L16 5.00006M12 14.5001L15 11.5001M18.5 8.00006L16.875 9.62506M12 19.5001L13.875 17.6251M19.5 12.0001L15.75 15.7501" />
                      <path d="M12 22C16.4183 22 20 18.3541 20 13.8567C20 9.39453 17.4467 4.18759 13.4629 2.32555C12.9986 2.10852 12.4993 2 12 2M12 22C7.58172 22 4 18.3541 4 13.8567C4 12.2707 4.32258 10.5906 4.91731 9M12 22V2M12 2C11.5007 2 11.0014 2.10852 10.5371 2.32555C8.93605 3.07388 7.56606 4.36246 6.5 5.92583" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-200">Symptoms Noted</p>
                    <p className="text-xs text-stone-400 mt-0.5">{summaryData.symptomsNoted}</p>
                  </div>
                </div>

                {/* Environment */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="20" cy="20" r="8" />
                      <line x1="20" y1="4" x2="20" y2="8" />
                      <line x1="20" y1="32" x2="20" y2="36" />
                      <line x1="4" y1="20" x2="8" y2="20" />
                      <line x1="32" y1="20" x2="36" y2="20" />
                      <line x1="8.5" y1="8.5" x2="11.3" y2="11.3" />
                      <line x1="28.7" y1="28.7" x2="31.5" y2="31.5" />
                      <line x1="31.5" y1="8.5" x2="28.7" y2="11.3" />
                      <line x1="11.3" y1="28.7" x2="8.5" y2="31.5" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-200">Environment Reviewed</p>
                    <p className="text-xs text-stone-400 mt-0.5">{summaryData.environmentReviewed}</p>
                  </div>
                </div>

                {/* Care History */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 512 512" fill="#22c55e">
                      <path d="M423.884,110.084c-33.862,0-64.181,18.89-79.124,49.297c-2.484,5.056-0.401,11.168,4.655,13.652c5.057,2.486,11.168,0.401,13.652-4.655c11.487-23.375,34.79-37.896,60.817-37.896c37.34,0,67.719,30.378,67.719,67.719c0,34.845-26.457,63.617-60.335,67.308v-65.786c0-5.633-4.566-10.199-10.199-10.199H196.99l-92.631-87.126c9.2-22.778,4.076-49.391-13.646-67.112c-3.983-3.983-10.441-3.983-14.425,0L2.987,108.586c-3.983,3.983-3.983,10.441,0,14.425c17.514,17.513,43.902,22.731,66.544,13.867l113.217,119.977v212.649c0,5.633,4.566,10.199,10.199,10.199h228.121c5.633,0,10.199-4.566,10.199-10.199V286.005c45.146-3.763,80.734-41.703,80.734-87.804C512.001,149.613,472.472,110.084,423.884,110.084z M410.868,238.328H296.611c-5.633,0-10.199,4.566-10.199,10.199c0,5.633,4.566,10.199,10.199,10.199h114.257v200.579H203.146V252.801c0-2.603-0.995-5.107-2.781-7L79.315,117.524c-3.194-3.385-8.277-4.179-12.35-1.928c-13.077,7.227-28.945,6.702-41.433-0.706L82.6,57.822c7.514,12.633,7.952,28.673,0.467,41.857c-2.322,4.092-1.546,9.241,1.882,12.465l101.011,95.008c1.891,1.78,4.391,2.77,6.987,2.77h217.921V238.328z"/>
                      <path d="M256.001,238.328h-20.306c-5.633,0-10.199,4.566-10.199,10.199c0,5.633,4.566,10.199,10.199,10.199h20.306c5.633,0,10.199-4.566,10.199-10.199C266.2,242.894,261.634,238.328,256.001,238.328z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-200">Care History Discussed</p>
                    <p className="text-xs text-stone-400 mt-0.5">{summaryData.careHistoryDiscussed}</p>
                  </div>
                </div>

                {/* Diagnosis */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="10" y="6" width="28" height="36" rx="3" />
                      <path d="M18 6 L18 4 Q24 2 30 4 L30 6" />
                      <path d="M16 24 L22 30 L32 18" strokeWidth="3" />
                      <line x1="16" y1="36" x2="32" y2="36" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-200">Diagnosis & Recommendations</p>
                    <p className="text-xs text-stone-400 mt-0.5">{summaryData.diagnosisGiven}</p>
                  </div>
                </div>
              </div>

              {/* View Full Conversation Button */}
              <button
                onClick={() => {
                  const next = !showFullConversation;
                  setShowFullConversation(next);
                  if (next) {
                    // Scroll to conversation after it renders
                    setTimeout(() => conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }
                }}
                className="w-full mt-4 py-3 px-4 bg-stone-900/50 active:bg-stone-800/50 rounded-xl text-stone-300 transition-colors flex items-center justify-center gap-2 border border-stone-700/50"
              >
                <svg className={`w-4 h-4 transition-transform ${showFullConversation ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-sm font-medium">
                  {showFullConversation ? 'Hide Full Conversation' : 'View Full Conversation'}
                </span>
              </button>

              {/* Full Conversation Transcript */}
              {showFullConversation && (
                <div ref={conversationRef} className="mt-4 bg-stone-900/50 rounded-xl p-4 border border-stone-800 text-sm text-stone-300 leading-relaxed">
                  {allMessages.length > 0 ? (
                    allMessages.map((m, i) => (
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
              )}
            </div>

            {/* Care Recommendations */}
            <div className="bg-stone-800/50 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-stone-100 mb-4">Ideal Care</h3>
              <div className="grid grid-cols-3 gap-4">
                {/* Light */}
                <div className="bg-stone-900/50 rounded-2xl p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="20" cy="20" r="8" />
                      <line x1="20" y1="4" x2="20" y2="8" />
                      <line x1="20" y1="32" x2="20" y2="36" />
                      <line x1="4" y1="20" x2="8" y2="20" />
                      <line x1="32" y1="20" x2="36" y2="20" />
                      <line x1="8.5" y1="8.5" x2="11.3" y2="11.3" />
                      <line x1="28.7" y1="28.7" x2="31.5" y2="31.5" />
                      <line x1="31.5" y1="8.5" x2="28.7" y2="11.3" />
                      <line x1="11.3" y1="28.7" x2="8.5" y2="31.5" />
                    </svg>
                  </div>
                  <p className="text-xs text-stone-400 mb-1">Light</p>
                  <p className="text-sm font-semibold text-stone-100">{summaryData.careRecommendations.light}</p>
                  <p className="text-xs text-stone-500 mt-1">{summaryData.careRecommendations.lightDetail}</p>
                </div>

                {/* Water */}
                <div className="bg-stone-900/50 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-stone-400 mb-1">Water</p>
                  <p className="text-sm font-semibold text-stone-100">{summaryData.careRecommendations.water}</p>
                  <p className="text-xs text-stone-500 mt-1">{summaryData.careRecommendations.waterDetail}</p>
                </div>

                {/* Temperature */}
                <div className="bg-stone-900/50 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-stone-400 mb-1">Temp</p>
                  <p className="text-sm font-semibold text-stone-100">{summaryData.careRecommendations.temp}</p>
                  <p className="text-xs text-stone-500 mt-1">{summaryData.careRecommendations.tempDetail}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {/* Top row: Share + Calendar */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const formattedSummary = `🌱 ${summaryData.plantName} Plant - Garden Walk Summary
${new Date().toLocaleDateString()}

📋 What We Covered:
✓ Plant: ${summaryData.plantIdentified}
✓ Symptoms: ${summaryData.symptomsNoted}
✓ Environment: ${summaryData.environmentReviewed}
✓ Care: ${summaryData.careHistoryDiscussed}
✓ Diagnosis: ${summaryData.diagnosisGiven}

💡 Ideal Care Recommendations:
☀️ Light: ${summaryData.careRecommendations.light} (${summaryData.careRecommendations.lightDetail})
💧 Water: ${summaryData.careRecommendations.water} (${summaryData.careRecommendations.waterDetail})
🌡️ Temperature: ${summaryData.careRecommendations.temp} (${summaryData.careRecommendations.tempDetail})

Generated by Gardening Whisperer`;
                    navigator.clipboard.writeText(formattedSummary).then(() => {
                      setCopiedSummary(true);
                      setTimeout(() => setCopiedSummary(false), 2000);
                    }).catch(() => {
                      // Clipboard write failed — don't show "Copied!" on failure
                      console.error('Clipboard write failed');
                    });
                  }}
                  aria-label="Copy summary to clipboard"
                  className={`flex-1 py-4 px-4 rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg ${
                    copiedSummary
                      ? 'bg-green-600 text-white'
                      : 'bg-stone-700 active:bg-stone-600 text-stone-200'
                  }`}
                >
                  {copiedSummary ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Share
                    </>
                  )}
                </button>

                {/* Calendar button */}
                <button
                  onClick={async () => {
                    if (!isCalendarConnected) {
                      calendarSignIn();
                      return;
                    }
                    if (calendarState === 'added') return;

                    setCalendarState('adding');
                    setCalendarError(null);
                    try {
                      const actions = {
                        doToday: [`Care for your ${summaryData.plantName}: ${summaryData.diagnosisGiven}`],
                        checkInDays: 3,
                        ifWorsens: [] as string[],
                      };
                      const eventData = formatCalendarEvent(
                        { plantName: summaryData.plantName, diagnosisGiven: summaryData.diagnosisGiven },
                        actions,
                      );
                      await createCalendarEvent(calendarToken!, eventData);
                      setCalendarState('added');
                    } catch (err) {
                      setCalendarState('error');
                      setCalendarError(err instanceof Error ? err.message : 'Could not add event');
                      setTimeout(() => { setCalendarState('idle'); setCalendarError(null); }, 4000);
                    }
                  }}
                  disabled={calendarState === 'adding'}
                  aria-label="Add reminder to Google Calendar"
                  className={`flex-1 py-4 px-4 rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg ${
                    calendarState === 'added'
                      ? 'bg-blue-600 text-white'
                      : calendarState === 'error'
                        ? 'bg-red-700 text-red-100'
                        : calendarState === 'adding'
                          ? 'bg-stone-600 text-stone-300'
                          : 'bg-stone-700 active:bg-stone-600 text-stone-200'
                  }`}
                >
                  {calendarState === 'adding' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : calendarState === 'added' ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Added!
                    </>
                  ) : calendarState === 'error' ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Failed
                    </>
                  ) : !isCalendarConnected ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} />
                        <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round" />
                        <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round" />
                        <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                      </svg>
                      Calendar
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} />
                        <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round" />
                        <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round" />
                        <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                        <path d="M12 14v4m-2-2h4" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                      Add to Cal
                    </>
                  )}
                </button>
              </div>

              {/* Calendar error message */}
              {calendarError && (
                <p className="text-xs text-red-400 text-center">{calendarError}</p>
              )}

              {/* Full-width New Walk */}
              <button
                onClick={handleReset}
                aria-label="Start a new garden walk"
                className="w-full py-4 px-4 bg-green-700 active:bg-green-600 rounded-2xl font-medium text-white transition-colors shadow-lg"
              >
                New Walk
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ERROR */}
      {appState === 'error' && (
        <div role="alert" className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
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
