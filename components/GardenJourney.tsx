'use client';

import { useEffect, useState } from 'react';

export type JourneyStage = 'start' | 'plant_id' | 'symptoms' | 'environment' | 'care_history' | 'complete';

interface GardenJourneyProps {
  currentStage: JourneyStage;
  isWalking: boolean;
}

const STAGES: JourneyStage[] = ['start', 'plant_id', 'symptoms', 'environment', 'care_history', 'complete'];

function getStageIndex(stage: JourneyStage): number {
  return STAGES.indexOf(stage);
}

// Quick Settings tile data
const TILE_DATA: { stage: JourneyStage; label: string; icon: string }[] = [
  { stage: 'start', label: 'Welcome', icon: 'gate' },
  { stage: 'plant_id', label: 'Plant ID', icon: 'plant' },
  { stage: 'symptoms', label: 'Symptoms', icon: 'symptoms' },
  { stage: 'environment', label: 'Environment', icon: 'sun' },
  { stage: 'care_history', label: 'Care', icon: 'water' },
  { stage: 'complete', label: 'Diagnosis', icon: 'check' },
];

// Stage labels for the At-a-Glance hero text
const STAGE_LABELS: Record<JourneyStage, { title: string; subtitle: string }> = {
  start: { title: 'Welcome', subtitle: 'Starting your garden walk' },
  plant_id: { title: 'Plant\nIdentification', subtitle: 'Tell me about your plant' },
  symptoms: { title: 'Symptom\nAssessment', subtitle: 'What symptoms do you see?' },
  environment: { title: 'Environment\nReview', subtitle: 'Tell me about its environment' },
  care_history: { title: 'Care\nHistory', subtitle: 'How have you been caring for it?' },
  complete: { title: 'Diagnosis\nReady', subtitle: 'Wrapping up your garden walk' },
};

function TileIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? '#22c55e' : '#78716c';

  switch (type) {
    case 'gate':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22V8" />
          <path d="M18 22V8" />
          <path d="M6 8Q12 2 18 8" />
          <circle cx="8" cy="12" r="1" fill={color} />
          <circle cx="16" cy="12" r="1" fill={color} />
        </svg>
      );
    case 'plant':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22V12" />
          <path d="M12 16Q8 14 6 8Q10 9 12 16" />
          <path d="M12 12Q16 8 18 3Q14 5 12 12" />
          <path d="M7 22Q12 20 17 22" />
        </svg>
      );
    case 'symptoms':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 18Q3 12 7 5Q12 3 17 5Q21 10 19 16Q14 20 5 18" />
          <path d="M8 16Q12 12 16 7" />
          <circle cx="10" cy="11" r="1.5" fill={color} />
          <circle cx="15" cy="13" r="1.5" fill={color} />
        </svg>
      );
    case 'sun':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
          <line x1="19.1" y1="4.9" x2="17.7" y2="6.3" />
          <line x1="6.3" y1="17.7" x2="4.9" y2="19.1" />
        </svg>
      );
    case 'water':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10V18H16V10Z" />
          <path d="M16 12L20 9L21 10" />
          <path d="M6 10Q6 5 10 5V10" />
          <line x1="19" y1="12" x2="19" y2="15" />
          <line x1="20" y1="13" x2="20" y2="16" />
        </svg>
      );
    case 'check':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M10 3V2Q12 1 14 2V3" />
          <path d="M9 12L11 14L15 10" strokeWidth="2" />
          <line x1="9" y1="18" x2="15" y2="18" />
        </svg>
      );
    default:
      return null;
  }
}

export function GardenJourney({ currentStage, isWalking }: GardenJourneyProps) {
  const [animatedStage, setAnimatedStage] = useState(currentStage);
  const currentIndex = getStageIndex(currentStage);

  // Smooth stage transitions
  useEffect(() => {
    if (isWalking) {
      const timer = setTimeout(() => {
        setAnimatedStage(currentStage);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setAnimatedStage(currentStage);
    }
  }, [currentStage, isWalking]);

  const animatedIndex = getStageIndex(animatedStage);
  const stageInfo = STAGE_LABELS[animatedStage];

  return (
    <div className="flex flex-col items-center w-full px-4 relative">
      {/* At-a-Glance Hero Text */}
      <div className="text-center mb-8 hero-crossfade" key={animatedStage}>
        <h2 className="text-[44px] leading-[1.1] tracking-tight text-pixel-on-surface whitespace-pre-line">
          {stageInfo.title.split('\n').map((line, i) => (
            <span key={i}>
              {i === 0 ? (
                <span className="font-light">{line}</span>
              ) : (
                <span className="font-bold">{line}</span>
              )}
              {i < stageInfo.title.split('\n').length - 1 && <br />}
            </span>
          ))}
        </h2>
        <p className="text-[13px] text-pixel-on-surface-variant mt-3 font-normal">
          {stageInfo.subtitle}
        </p>
      </div>

      {/* Quick Settings Grid - 3x2 */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {TILE_DATA.map((tile, i) => {
          const tileIndex = getStageIndex(tile.stage);
          const isComplete = tileIndex < animatedIndex;
          const isActive = tileIndex === animatedIndex;
          const isPending = tileIndex > animatedIndex;

          return (
            <div
              key={tile.stage}
              className={`
                flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-pixel transition-all duration-500
                ${isComplete
                  ? 'bg-garden-900/50 tile-complete'
                  : isActive
                    ? 'bg-pixel-surface-bright ring-1 ring-garden-500/30'
                    : 'bg-pixel-surface'
                }
              `}
            >
              <div className={`transition-all duration-500 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                <TileIcon type={tile.icon} active={isComplete || isActive} />
              </div>
              <span className={`text-[11px] font-medium uppercase tracking-wider transition-colors duration-500 ${
                isComplete
                  ? 'text-garden-500'
                  : isActive
                    ? 'text-pixel-on-surface'
                    : 'text-pixel-on-surface-variant/50'
              }`}>
                {tile.label}
              </span>
              {/* Completion indicator */}
              {isComplete && (
                <div className="w-1.5 h-1.5 rounded-full bg-garden-500" />
              )}
              {isActive && isWalking && (
                <div className="w-1.5 h-1.5 rounded-full bg-garden-400 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
