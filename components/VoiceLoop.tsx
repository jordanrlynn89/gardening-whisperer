'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useAmbientSound } from '@/hooks/useAmbientSound';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useSpeechCommand } from '@/hooks/useSpeechCommand';
import { formatCalendarEvent, createCalendarEvent } from '@/lib/googleCalendar';
import { extractFollowUp } from '@/lib/followUpExtraction';
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
const CameraCapture = dynamic(
  () => import('./CameraCapture').then(mod => ({ default: mod.CameraCapture })),
  { ssr: false }
);

type AppState = 'idle' | 'connecting' | 'active' | 'summary' | 'error';
type PhotoState = 'none' | 'capturing_camera' | 'processing';

function matchesCaptureCommand(text: string): boolean {
  return (
    text.includes('take photo') || text.includes('take a photo') ||
    text.includes('take the photo') || text.includes('capture photo') ||
    text.includes('capture the photo') || text.includes('snap') ||
    text.includes('take picture') || text.includes('take a picture') ||
    text.includes('take the picture') || text.includes('this is the plant') ||
    text.includes('this is my plant') || text.includes('here is the plant') ||
    text.includes('here is my plant')
  );
}

function matchesDeclineCommand(text: string): boolean {
  return (
    text.includes("don't want") ||
    text.includes("no photo") ||
    text.includes("no picture") ||
    text.includes("can't take") ||
    text.includes("skip") ||
    text.includes("not right now") ||
    text.includes("maybe later") ||
    text.includes("no thanks") ||
    text.includes("never mind") ||
    text.includes("without a photo") ||
    text.includes("without photo")
  );
}

// --- Status Pill Component (Pixel Dynamic Island style) ---
function StatusPill({ isSpeaking, isListening, isConnected, appState }: {
  isSpeaking: boolean;
  isListening: boolean;
  isConnected: boolean;
  appState: AppState;
}) {
  let label = 'Ready';
  let dotColor = 'bg-stone-500';
  let textColor = 'text-pixel-on-surface-variant';

  if (appState === 'connecting') {
    label = 'Connecting...';
    dotColor = 'bg-amber-400 animate-pulse';
    textColor = 'text-amber-400';
  } else if (appState === 'active') {
    if (isSpeaking) {
      label = 'Speaking';
      dotColor = 'bg-blue-500 speaking-indicator';
      textColor = 'text-blue-400';
    } else if (isListening) {
      label = 'Listening';
      dotColor = 'bg-garden-500 listening-indicator';
      textColor = 'text-garden-400';
    } else if (isConnected) {
      label = 'Connected';
      dotColor = 'bg-stone-400';
      textColor = 'text-pixel-on-surface-variant';
    }
  } else if (appState === 'summary') {
    label = 'Walk Complete';
    dotColor = 'bg-garden-500';
    textColor = 'text-garden-400';
  } else if (appState === 'error') {
    label = 'Error';
    dotColor = 'bg-red-500';
    textColor = 'text-red-400';
  }

  return (
    <div
      className="status-pill-enter inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-pixel-surface border border-pixel-surface-bright"
      aria-live="polite"
    >
      <div className={`w-2 h-2 rounded-full ${dotColor} transition-all duration-300`} />
      <span className={`text-[13px] font-medium ${textColor} transition-colors duration-300`}>
        {label}
      </span>
    </div>
  );
}

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
  const capturePhotoRef = useRef<(() => void) | null>(null);
  const photoCooldownUntilRef = useRef<number>(0);

  const { isConnected: isCalendarConnected, accessToken: calendarToken, isGISReady, signIn: calendarSignIn, signOut: calendarSignOut, error: calendarSetupError } = useGoogleCalendar();

  const { startAmbient, stopAmbient, duck, unduck } = useAmbientSound({
    volume: 0.12,
    duckingVolume: 0.04,
  });

  const {
    connect,
    disconnect,
    sendText,
    suppressOutput,
    pauseMic,
    resumeMic,
    stopAudio,
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
      console.log('[VoiceLoop] Walk complete signal received from server');
      setWalkCompleted(true);
      stopAmbient();
      setTimeout(() => {
        console.log('[VoiceLoop] Transitioning to summary now');
        disconnect();
        setAppState('summary');
        setVolume(0);
      }, 2000);
    },
  });

  // Stable ref so the speech command callback always has the latest sendText
  const sendTextRef = useRef(sendText);
  sendTextRef.current = sendText;

  const { start: startSpeechCommand, stop: stopSpeechCommand } = useSpeechCommand({
    onTranscript: useCallback((text: string, isFinal: boolean) => {
      if (!isFinal) return;
      const lower = text.toLowerCase();
      if (matchesCaptureCommand(lower)) {
        console.log('[VoiceLoop] Voice capture command detected via local speech');
        if (capturePhotoRef.current) {
          capturePhotoRef.current();
        } else {
          console.log('[VoiceLoop] Camera not ready yet, queuing capture');
          const poll = setInterval(() => {
            if (capturePhotoRef.current) {
              clearInterval(poll);
              capturePhotoRef.current();
            }
          }, 200);
          setTimeout(() => clearInterval(poll), 5000);
        }
      } else if (matchesDeclineCommand(lower)) {
        console.log('[VoiceLoop] User declined photo verbally via local speech');
        setPhotoState('none');
        sendTextRef.current('[User declined to take a photo. Continue the garden walk from where you left off.]');
      }
    }, []),
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

  // Detect photo triggers from completed messages
  const lastMessageRef = useRef(0);
  useEffect(() => {
    if (messages.length <= lastMessageRef.current) return;
    const newMessages = messages.slice(lastMessageRef.current);
    lastMessageRef.current = messages.length;

    for (const msg of newMessages) {
      const source = msg.role === 'assistant' ? 'ai' : 'user';
      if (hasPhotoTrigger(msg.content, source) && photoState === 'none' && Date.now() > photoCooldownUntilRef.current) {
        console.log('[VoiceLoop] Photo trigger detected in completed message:', msg.content.slice(0, 80));
        if (source === 'ai' && isSpeaking) {
          pendingPhotoTriggerRef.current = true;
        } else {
          pendingPhotoTriggerRef.current = false;
          setPhotoState('capturing_camera');
          speakPhotoPrompt();
        }
        break;
      }
    }
  }, [messages, photoState, isSpeaking, speakPhotoPrompt]);

  // Show photo UI once AI finishes speaking
  useEffect(() => {
    if (!isSpeaking && pendingPhotoTriggerRef.current && photoState === 'none' && Date.now() > photoCooldownUntilRef.current) {
      pendingPhotoTriggerRef.current = false;
      console.log('[VoiceLoop] AI finished speaking — showing camera');
      setPhotoState('capturing_camera');
      speakPhotoPrompt();
    }
  }, [isSpeaking, photoState, speakPhotoPrompt]);

  // Also detect from streaming AI transcripts
  useEffect(() => {
    if (!aiTranscript || photoState !== 'none' || Date.now() <= photoCooldownUntilRef.current) return;
    if (hasPhotoTrigger(aiTranscript, 'ai')) {
      pendingPhotoTriggerRef.current = true;
    }
  }, [aiTranscript, photoState]);

  useEffect(() => {
    if (!userTranscript || photoState !== 'none' || Date.now() <= photoCooldownUntilRef.current) return;
    if (hasPhotoTrigger(userTranscript, 'user')) {
      pendingPhotoTriggerRef.current = false;
      setPhotoState('capturing_camera');
      speakPhotoPrompt();
    }
  }, [userTranscript, photoState, speakPhotoPrompt]);

  // Manage mic, output suppression, and local speech recognition during photo flow
  useEffect(() => {
    if (photoState === 'capturing_camera') {
      console.log('[VoiceLoop] Camera activated — stopping AI audio and pausing mic');
      stopAudio(); // Stop any currently playing AI audio
      pauseMic();
      suppressOutput(true);
      startSpeechCommand();
      // Signal AI to stop asking questions while photo is being taken
      sendText('[CAMERA_ACTIVE]');
    } else if (photoState === 'processing') {
      stopSpeechCommand();
    } else {
      stopSpeechCommand();
      suppressOutput(false);
      resumeMic();
    }
  }, [photoState, pauseMic, resumeMic, stopAudio, sendText, suppressOutput, startSpeechCommand, stopSpeechCommand]);

  // Stage only advances forward, never regresses
  const [currentStage, setCurrentStage] = useState<JourneyStage>('start');

  useEffect(() => {
    if (walkCompleted) {
      setCurrentStage('complete');
      return;
    }

    const stageFromMessages = messages.length > 0 ? detectStageFromMessages(messages) : 'start';

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
  useEffect(() => {
    if (geminiError && (appState === 'connecting' || appState === 'active')) {
      setErrorMsg(geminiError);
      setAppState('error');
      stopAmbient();
    }
  }, [geminiError, appState, stopAmbient]);

  const handleStart = async () => {
    if (appState !== 'idle') return;
    setAppState('connecting');
    setErrorMsg(null);
    setCurrentStage('start');
    prevStageRef.current = 'start';

    try {
      startAmbient();
      await connect();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setAppState('error');
      stopAmbient();
    }
  };

  const handleEnd = () => {
    stopAmbient();
    disconnect();
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

  const handlePhotoCapture = useCallback(
    async (imageData: string) => {
      console.log('[VoiceLoop] Photo captured, size:', imageData?.length || 0);

      if (!imageData) {
        console.warn('[VoiceLoop] Capture returned empty — closing camera');
        setPhotoState('none');
        return;
      }

      setPhotoState('processing');

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

      photoCooldownUntilRef.current = Date.now() + 90000;
      setPhotoState('none');
    },
    [sendText, messages, messagesRef]
  );

  const handlePhotoCancel = () => {
    photoCooldownUntilRef.current = Date.now() + 30000;
    setPhotoState('none');
  };

  const backgroundGradient = getBackgroundGradient(currentStage);

  return (
    <div className="relative w-full h-dvh bg-pixel-bg overflow-hidden font-pixel">
      <Visualizer volume={volume} isActive={appState === 'active'} />

      {/* Dynamic ambient background gradient */}
      <div
        className={`absolute inset-0 pointer-events-none z-0 ambient-bg ${backgroundGradient}`}
        style={{ opacity: 0.4 }}
      />

      {/* IDLE */}
      {appState === 'idle' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center hero-crossfade">
          {/* Status Pill */}
          <div className="absolute top-0 left-0 right-0 flex justify-center" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <StatusPill isSpeaking={false} isListening={false} isConnected={false} appState={appState} />
          </div>

          {/* At-a-Glance Hero */}
          <div className="flex flex-col items-center mb-12">
            <h1 className="text-[48px] leading-[1.1] tracking-tight mb-3">
              <span className="font-light text-pixel-on-surface">Gardening</span>
              <br />
              <span className="font-bold text-pixel-on-surface">Whisperer</span>
            </h1>
            <p className="text-[15px] text-pixel-on-surface-variant font-normal leading-relaxed">
              Your AI garden companion
            </p>
          </div>

          {/* Action Pill Bar */}
          <button
            onClick={handleStart}
            aria-label="Start garden walk"
            className="px-10 py-4 bg-garden-500 rounded-pill text-white text-[16px] font-medium transition-all duration-200 pill-press shadow-xl shadow-garden-500/20 hover:bg-garden-400 active:bg-garden-600"
          >
            Start Garden Walk
          </button>
        </div>
      )}

      {/* CONNECTING */}
      {appState === 'connecting' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full hero-crossfade">
          {/* Status Pill */}
          <div className="absolute top-0 left-0 right-0 flex justify-center" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <StatusPill isSpeaking={false} isListening={false} isConnected={false} appState={appState} />
          </div>

          <h2 className="text-[48px] leading-[1.1] tracking-tight mb-4">
            <span className="font-light text-pixel-on-surface">Entering</span>
            <br />
            <span className="font-bold text-pixel-on-surface">the Garden</span>
          </h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-garden-500 mt-4" />
        </div>
      )}

      {/* ACTIVE */}
      {appState === 'active' && (
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Status Pill - top center */}
          <div className="flex justify-center w-full" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <StatusPill isSpeaking={isSpeaking} isListening={isListening} isConnected={isConnected} appState={appState} />
          </div>

          {/* Visually hidden live region for screen readers */}
          <div
            aria-live="polite"
            aria-atomic="false"
            className="sr-only"
          >
            {aiTranscript && <p>Gardener: {aiTranscript}</p>}
            {userTranscript && <p>You: {userTranscript}</p>}
          </div>

          {/* Garden Journey - Quick Settings Grid with At-a-Glance hero */}
          <div className="flex-1 flex items-center justify-center pb-24">
            <GardenJourney currentStage={currentStage} isWalking={isWalking} />
          </div>

          {/* Action Pill Bar - Bottom */}
          <div className="absolute left-0 right-0 bottom-0 z-20 flex justify-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <button
              onClick={handleEnd}
              aria-label="End garden walk"
              className="px-8 py-3.5 bg-red-500/20 border border-red-500/40 rounded-pill text-red-300 text-[15px] font-medium transition-all duration-200 pill-press backdrop-blur-md hover:bg-red-500/30 active:bg-red-500/40"
            >
              End Walk
            </button>
          </div>

          {/* Photo UI States */}
          {photoState === 'capturing_camera' && (
            <CameraCapture
              onCapture={handlePhotoCapture}
              onCancel={handlePhotoCancel}
              onCaptureReady={(fn) => { capturePhotoRef.current = fn; }}
            />
          )}

          {photoState === 'processing' && (
            <div
              role="status"
              aria-label="Analyzing your plant photo"
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] hero-crossfade"
            >
              <div className="text-center bg-pixel-surface rounded-pixel p-8 border border-pixel-surface-bright mx-6">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-3 border-garden-500" />
                  <svg className="absolute inset-0 m-auto w-8 h-8 text-garden-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 22C16.4183 22 20 18.3541 20 13.8567C20 9.39453 17.4467 4.18759 13.4629 2.32555C12.9986 2.10852 12.4993 2 12 2M12 22C7.58172 22 4 18.3541 4 13.8567C4 12.2707 4.32258 10.5906 4.91731 9M12 22V2" />
                  </svg>
                </div>
                <p className="text-xl font-medium text-pixel-on-surface mb-2">Analyzing your plant...</p>
                <p className="text-sm text-pixel-on-surface-variant">This usually takes a few seconds</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {appState === 'summary' && (() => {
        const backup = messagesRef.current ?? [];
        const allMessages = messages.length >= backup.length ? messages : backup;
        const summaryData = generateSummaryData(allMessages);
        const followUp = extractFollowUp(allMessages);
        return (
        <div className="relative z-10 flex flex-col items-center justify-start h-full overflow-y-auto px-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {/* Status Pill */}
          <div className="mb-6">
            <StatusPill isSpeaking={false} isListening={false} isConnected={false} appState={appState} />
          </div>

          <div className="w-full max-w-md">
            {/* Close button */}
            <button
              onClick={handleReset}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-pill bg-pixel-surface active:bg-pixel-surface-bright text-pixel-on-surface-variant transition-all duration-200 z-20"
              aria-label="Close summary"
              style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Widget 1: Plant Hero Card */}
            <div className="widget-stack-in widget-delay-1 bg-pixel-surface rounded-pixel p-6 mb-3 border border-pixel-surface-bright">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-pixel bg-garden-900/50 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22V12" />
                    <path d="M12 16Q8 14 6 8Q10 9 12 16" />
                    <path d="M12 12Q16 8 18 3Q14 5 12 12" />
                    <path d="M7 22Q12 20 17 22" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-pixel-on-surface">{summaryData.plantName}</h2>
                  <p className="text-[11px] text-pixel-on-surface-variant uppercase tracking-wider font-medium">
                    Garden Walk - {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Widget 2: What We Covered - Notification style cards */}
            <div className="widget-stack-in widget-delay-2 bg-pixel-surface rounded-pixel p-5 mb-3 border border-pixel-surface-bright">
              <h3 className="text-[12px] font-medium uppercase tracking-wider text-pixel-on-surface-variant mb-4">What We Covered</h3>
              <div className="space-y-3">
                {[
                  { label: 'Plant Identified', value: summaryData.plantIdentified, color: 'border-garden-500' },
                  { label: 'Symptoms Noted', value: summaryData.symptomsNoted, color: 'border-amber-500' },
                  { label: 'Environment Reviewed', value: summaryData.environmentReviewed, color: 'border-blue-500' },
                  { label: 'Care History', value: summaryData.careHistoryDiscussed, color: 'border-purple-500' },
                  { label: 'Diagnosis', value: summaryData.diagnosisGiven, color: 'border-garden-500' },
                ].map((item, i) => (
                  <div key={i} className={`card-slide-in bg-pixel-surface-bright rounded-xl p-3 border-l-[3px] ${item.color}`} style={{ animationDelay: `${i * 0.06}s` }}>
                    <p className="text-[12px] font-medium text-pixel-on-surface mb-0.5">{item.label}</p>
                    <p className="text-[13px] text-pixel-on-surface-variant leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* View Full Conversation Button */}
              <button
                onClick={() => {
                  const next = !showFullConversation;
                  setShowFullConversation(next);
                  if (next) {
                    setTimeout(() => conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }
                }}
                className="w-full mt-4 py-3 px-4 bg-pixel-bg rounded-xl text-pixel-on-surface-variant transition-colors flex items-center justify-center gap-2 border border-pixel-surface-bright"
              >
                <svg className={`w-4 h-4 transition-transform ${showFullConversation ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-[13px] font-medium">
                  {showFullConversation ? 'Hide Conversation' : 'View Conversation'}
                </span>
              </button>

              {/* Full Conversation Transcript */}
              {showFullConversation && (
                <div ref={conversationRef} className="mt-4 bg-pixel-bg rounded-xl p-4 border border-pixel-surface-bright text-[14px] text-pixel-on-surface-variant leading-relaxed">
                  {allMessages.length > 0 ? (
                    allMessages.map((m, i) => (
                      <div key={i} className="mb-3">
                        <span className={`font-bold text-[11px] uppercase ${m.role === 'assistant' ? 'text-garden-500' : 'text-pixel-on-surface-variant'}`}>
                          {m.role === 'assistant' ? 'Gardener' : 'You'}
                        </span>
                        <p className="mt-1">{m.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="italic text-pixel-on-surface-variant/50">No conversation recorded.</p>
                  )}
                </div>
              )}
            </div>

            {/* Widget 3: Ideal Care - Grid */}
            <div className="widget-stack-in widget-delay-3 bg-pixel-surface rounded-pixel p-5 mb-3 border border-pixel-surface-bright">
              <h3 className="text-[12px] font-medium uppercase tracking-wider text-pixel-on-surface-variant mb-4">Ideal Care</h3>
              <div className="grid grid-cols-3 gap-3">
                {/* Light */}
                <div className="bg-pixel-bg rounded-xl p-3 text-center border border-pixel-surface-bright">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-yellow-500/15 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="4" />
                      <line x1="12" y1="2" x2="12" y2="4" />
                      <line x1="12" y1="20" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="4" y2="12" />
                      <line x1="20" y1="12" x2="22" y2="12" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-pixel-on-surface-variant mb-1">Light</p>
                  <p className="text-[13px] font-semibold text-pixel-on-surface">{summaryData.careRecommendations.light}</p>
                  <p className="text-[11px] text-pixel-on-surface-variant mt-1">{summaryData.careRecommendations.lightDetail}</p>
                </div>

                {/* Water */}
                <div className="bg-pixel-bg rounded-xl p-3 text-center border border-pixel-surface-bright">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-500/15 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-pixel-on-surface-variant mb-1">Water</p>
                  <p className="text-[13px] font-semibold text-pixel-on-surface">{summaryData.careRecommendations.water}</p>
                  <p className="text-[11px] text-pixel-on-surface-variant mt-1">{summaryData.careRecommendations.waterDetail}</p>
                </div>

                {/* Temperature */}
                <div className="bg-pixel-bg rounded-xl p-3 text-center border border-pixel-surface-bright">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-red-500/15 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-pixel-on-surface-variant mb-1">Temp</p>
                  <p className="text-[13px] font-semibold text-pixel-on-surface">{summaryData.careRecommendations.temp}</p>
                  <p className="text-[11px] text-pixel-on-surface-variant mt-1">{summaryData.careRecommendations.tempDetail}</p>
                </div>
              </div>
            </div>

            {/* Action Pill Buttons */}
            <div className="widget-stack-in widget-delay-4 flex flex-col gap-3 mt-2">
              {/* Top row: Share + Calendar */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const formattedSummary = `${summaryData.plantName} Plant - Garden Walk Summary
${new Date().toLocaleDateString()}

What We Covered:
- Plant: ${summaryData.plantIdentified}
- Symptoms: ${summaryData.symptomsNoted}
- Environment: ${summaryData.environmentReviewed}
- Care: ${summaryData.careHistoryDiscussed}
- Diagnosis: ${summaryData.diagnosisGiven}

Ideal Care:
- Light: ${summaryData.careRecommendations.light} (${summaryData.careRecommendations.lightDetail})
- Water: ${summaryData.careRecommendations.water} (${summaryData.careRecommendations.waterDetail})
- Temp: ${summaryData.careRecommendations.temp} (${summaryData.careRecommendations.tempDetail})

Generated by Gardening Whisperer`;
                    navigator.clipboard.writeText(formattedSummary).then(() => {
                      setCopiedSummary(true);
                      setTimeout(() => setCopiedSummary(false), 2000);
                    }).catch(() => {
                      console.error('Clipboard write failed');
                    });
                  }}
                  aria-label="Copy summary to clipboard"
                  className={`flex-1 py-3.5 px-4 rounded-pill font-medium text-[15px] transition-all duration-200 pill-press flex items-center justify-center gap-2 ${
                    copiedSummary
                      ? 'bg-garden-600 text-white'
                      : 'bg-pixel-surface border border-pixel-surface-bright text-pixel-on-surface'
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
                    console.log('[Calendar] Button clicked. Connected:', isCalendarConnected, 'State:', calendarState);
                    if (!isCalendarConnected) {
                      console.log('[Calendar] Not connected - requesting sign in');
                      if (!isGISReady) {
                        setCalendarState('error');
                        setCalendarError('Google Sign-In not available');
                        setTimeout(() => { setCalendarState('idle'); setCalendarError(null); }, 4000);
                        return;
                      }
                      calendarSignIn();
                      return;
                    }
                    if (calendarState === 'added') {
                      console.log('[Calendar] Already added - ignoring click');
                      return;
                    }

                    setCalendarState('adding');
                    setCalendarError(null);
                    try {
                      const actions = {
                        doToday: [`Care for your ${summaryData.plantName}: ${summaryData.diagnosisGiven}`],
                        checkInDays: followUp?.days ?? 3,
                        ifWorsens: [] as string[],
                      };
                      const eventData = formatCalendarEvent(
                        { plantName: summaryData.plantName, diagnosisGiven: summaryData.diagnosisGiven, action: followUp?.action },
                        actions,
                      );
                      console.log('[Calendar] Creating event:', eventData.summary);
                      await createCalendarEvent(calendarToken!, eventData);
                      console.log('[Calendar] Event created successfully');
                      setCalendarState('added');
                    } catch (err) {
                      console.error('[Calendar] Failed to create event:', err);
                      setCalendarState('error');
                      setCalendarError(err instanceof Error ? err.message : 'Could not add event');
                      setTimeout(() => { setCalendarState('idle'); setCalendarError(null); }, 4000);
                    }
                  }}
                  disabled={calendarState === 'adding'}
                  aria-label="Add reminder to Google Calendar"
                  className={`flex-1 py-3.5 px-4 rounded-pill font-medium text-[15px] transition-all duration-200 pill-press flex items-center justify-center gap-2 ${
                    calendarState === 'added'
                      ? 'bg-blue-600 text-white'
                      : calendarState === 'error'
                        ? 'bg-red-700 text-red-100'
                        : calendarState === 'adding'
                          ? 'bg-pixel-surface-bright text-pixel-on-surface-variant'
                          : 'bg-pixel-surface border border-pixel-surface-bright text-pixel-on-surface'
                  }`}
                >
                  {calendarState === 'adding' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-pixel-on-surface-variant border-t-transparent rounded-full animate-spin" />
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
                      {followUp ? `Check in ${followUp.days} day${followUp.days === 1 ? '' : 's'}` : 'Add to Cal'}
                    </>
                  )}
                </button>
              </div>

              {/* Calendar error message */}
              {(calendarError || calendarSetupError) && (
                <p className="text-[12px] text-red-400 text-center">{calendarError || calendarSetupError}</p>
              )}

              {/* Full-width New Walk pill */}
              <button
                onClick={handleReset}
                aria-label="Start a new garden walk"
                className="w-full py-4 px-4 bg-garden-600 rounded-pill font-medium text-[16px] text-white transition-all duration-200 pill-press shadow-lg shadow-garden-600/20"
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
          {/* Status Pill */}
          <div className="absolute top-0 left-0 right-0 flex justify-center" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <StatusPill isSpeaking={false} isListening={false} isConnected={false} appState={appState} />
          </div>

          <h2 className="text-[48px] leading-[1.1] tracking-tight mb-4 hero-crossfade">
            <span className="font-light text-pixel-on-surface">Connection</span>
            <br />
            <span className="font-bold text-red-400">Error</span>
          </h2>
          <p className="text-[15px] text-pixel-on-surface-variant mb-8 max-w-xs leading-relaxed">
            {errorMsg || 'Something went wrong in the garden.'}
          </p>
          <button
            onClick={handleReset}
            className="px-8 py-3.5 bg-pixel-surface border border-pixel-surface-bright rounded-pill text-pixel-on-surface text-[15px] font-medium transition-all duration-200 pill-press"
          >
            Return Home
          </button>
        </div>
      )}
    </div>
  );
}
