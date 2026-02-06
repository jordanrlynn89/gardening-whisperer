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

// Garden Archway Icon
function ArchwayIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke={active ? '#22c55e' : '#57534e'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-500 ${active ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}`}
    >
      {/* Archway posts */}
      <line x1="12" y1="44" x2="12" y2="16" />
      <line x1="36" y1="44" x2="36" y2="16" />
      {/* Arch */}
      <path d="M12 16 Q24 4 36 16" />
      {/* Decorative vines */}
      <path d="M14 20 Q16 22 14 26" />
      <path d="M34 20 Q32 22 34 26" />
      {/* Small leaves */}
      <circle cx="15" cy="24" r="2" />
      <circle cx="33" cy="24" r="2" />
    </svg>
  );
}

// Plant/Seedling Icon (leaf design)
function PlantIcon({ visible, active }: { visible: boolean; active: boolean }) {
  const leafColor = active ? '#22c55e' : '#57534e';
  const accentColor = active ? '#16a34a' : '#52524f';

  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 1000 500"
      className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${active ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}`}
    >
      <g fill={leafColor}>
        {/* Main leaf shape */}
        <path d="M109.7 257.6s433.6 432.9 665.7 0c-217.3-467.1-665.7 0-665.7 0Z" />
        {/* Leaf vein/accent */}
        <path d="M890.1 254.4a6 6 0 0 0-7.4-3.9c-.4.1-37.8 11.2-106.5 2.3-249.7-32.5-438.6-8.9-440.5-8.6a5.8 5.8 0 0 0-5.1 6.7 6 6 0 0 0 6.7 5.2c1.9-.2 189.4-23.7 437.4 8.6a407 407 0 0 0 53.2 3.6c37.3 0 57.2-6 58.3-6.3a6 6 0 0 0 3.9-7.4Z" fill={accentColor} />
      </g>
    </svg>
  );
}

// Symptoms Icon (spotted/wilting leaf)
function SymptomsIcon({ visible, active }: { visible: boolean; active: boolean }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke={active ? '#22c55e' : '#57534e'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${active ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}`}
    >
      {/* Leaf outline */}
      <path d="M8 32 Q4 20 12 8 Q20 4 28 8 Q36 16 32 28 Q24 36 8 32" />
      {/* Leaf vein */}
      <path d="M12 28 Q20 20 26 10" />
      {/* Spots (symptoms) */}
      <circle cx="16" cy="18" r="2" fill={active ? '#22c55e' : '#57534e'} />
      <circle cx="24" cy="22" r="2" fill={active ? '#22c55e' : '#57534e'} />
      <circle cx="18" cy="26" r="1.5" fill={active ? '#22c55e' : '#57534e'} />
    </svg>
  );
}

// Environment Icon (sun with rays)
function EnvironmentIcon({ visible, active }: { visible: boolean; active: boolean }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke={active ? '#22c55e' : '#57534e'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${active ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}`}
    >
      {/* Sun circle */}
      <circle cx="20" cy="20" r="8" />
      {/* Rays */}
      <line x1="20" y1="4" x2="20" y2="8" />
      <line x1="20" y1="32" x2="20" y2="36" />
      <line x1="4" y1="20" x2="8" y2="20" />
      <line x1="32" y1="20" x2="36" y2="20" />
      {/* Diagonal rays */}
      <line x1="8.5" y1="8.5" x2="11.3" y2="11.3" />
      <line x1="28.7" y1="28.7" x2="31.5" y2="31.5" />
      <line x1="31.5" y1="8.5" x2="28.7" y2="11.3" />
      <line x1="11.3" y1="28.7" x2="8.5" y2="31.5" />
    </svg>
  );
}

// Care History Icon (watering can)
function CareIcon({ visible, active }: { visible: boolean; active: boolean }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke={active ? '#22c55e' : '#57534e'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${active ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}`}
    >
      {/* Can body */}
      <path d="M8 18 L8 32 L28 32 L28 18 Z" />
      {/* Spout */}
      <path d="M28 22 L36 16 L38 18" />
      {/* Handle */}
      <path d="M10 18 Q10 10 18 10 L18 18" />
      {/* Water drops */}
      <line x1="34" y1="22" x2="34" y2="26" />
      <line x1="36" y1="24" x2="36" y2="28" />
    </svg>
  );
}

// Diagnosis Gate Icon
function DiagnosisIcon({ visible, active }: { visible: boolean; active: boolean }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke={active ? '#22c55e' : '#57534e'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${active ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : ''}`}
    >
      {/* Card/clipboard outline */}
      <rect x="10" y="6" width="28" height="36" rx="3" />
      {/* Clipboard clip */}
      <path d="M18 6 L18 4 Q24 2 30 4 L30 6" />
      {/* Checkmark */}
      <path d="M16 24 L22 30 L32 18" strokeWidth="3" />
      {/* Lines for text */}
      <line x1="16" y1="36" x2="32" y2="36" />
    </svg>
  );
}

// Footsteps animation between stages
function Footsteps({ animate }: { animate: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 h-8 sm:h-12 justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full bg-stone-600 transition-all duration-300 ${
            animate ? 'animate-pulse' : ''
          }`}
          style={{
            animationDelay: animate ? `${i * 150}ms` : '0ms',
            opacity: animate ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// Stage labels
const STAGE_LABELS: Record<JourneyStage, string> = {
  start: 'Welcome to the Garden',
  plant_id: 'What plant do you have?',
  symptoms: 'What symptoms do you see?',
  environment: 'Tell me about its environment',
  care_history: 'How have you been caring for it?',
  complete: 'Diagnosis Ready',
};

export function GardenJourney({ currentStage, isWalking }: GardenJourneyProps) {
  const [animatedStage, setAnimatedStage] = useState(currentStage);
  const currentIndex = getStageIndex(currentStage);

  // Smooth stage transitions
  useEffect(() => {
    if (isWalking) {
      // Delay updating animated stage until walking animation completes
      const timer = setTimeout(() => {
        setAnimatedStage(currentStage);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setAnimatedStage(currentStage);
    }
  }, [currentStage, isWalking]);

  const animatedIndex = getStageIndex(animatedStage);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-6 relative">
      {/* Decorative vine paths (left and right) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute left-0 top-0 w-12 h-full" viewBox="0 0 48 600" preserveAspectRatio="none">
          <path
            d="M24 0 Q10 50 24 100 Q38 150 24 200 Q10 250 24 300 Q38 350 24 400 Q10 450 24 500 Q38 550 24 600"
            stroke="url(#vineGradient)"
            strokeWidth="1"
            fill="none"
            opacity="0.15"
            strokeDasharray="4 4"
          />
          <defs>
            <linearGradient id="vineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
        <svg className="absolute right-0 top-0 w-12 h-full" viewBox="0 0 48 600" preserveAspectRatio="none">
          <path
            d="M24 0 Q38 50 24 100 Q10 150 24 200 Q38 250 24 300 Q10 350 24 400 Q38 450 24 500 Q10 550 24 600"
            stroke="url(#vineGradient2)"
            strokeWidth="1"
            fill="none"
            opacity="0.15"
            strokeDasharray="4 4"
          />
          <defs>
            <linearGradient id="vineGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Journey Path */}
      <div className="flex flex-col items-center gap-1 sm:gap-2 py-4 sm:py-8 mt-12 relative z-10">
        {/* Start: Archway */}
        <div className="flex flex-col items-center">
          <ArchwayIcon active={animatedIndex === 0} />
          {animatedIndex === 0 && (
            <span className="text-xs text-stone-400 mt-2 animate-pulse">Enter</span>
          )}
        </div>

        <Footsteps animate={isWalking && currentIndex === 1} />

        {/* Stage 1: Plant ID */}
        <div className="flex flex-col items-center">
          <PlantIcon
            visible={animatedIndex >= 1}
            active={animatedIndex === 1}
          />
        </div>

        <Footsteps animate={isWalking && currentIndex === 2} />

        {/* Stage 2: Symptoms */}
        <div className="flex flex-col items-center">
          <SymptomsIcon visible={animatedIndex >= 2} active={animatedIndex === 2} />
        </div>

        <Footsteps animate={isWalking && currentIndex === 3} />

        {/* Stage 3: Environment */}
        <div className="flex flex-col items-center">
          <EnvironmentIcon visible={animatedIndex >= 3} active={animatedIndex === 3} />
        </div>

        <Footsteps animate={isWalking && currentIndex === 4} />

        {/* Stage 4: Care History */}
        <div className="flex flex-col items-center">
          <CareIcon visible={animatedIndex >= 4} active={animatedIndex === 4} />
        </div>

        <Footsteps animate={isWalking && currentIndex === 5} />

        {/* End: Diagnosis */}
        <div className="flex flex-col items-center">
          <DiagnosisIcon visible={animatedIndex >= 5} active={animatedIndex === 5} />
        </div>
      </div>

      {/* Current Stage Label */}
      <div className="mt-1 text-center">
        <p className="text-sm text-stone-300 tracking-wide uppercase font-semibold">
          {STAGE_LABELS[animatedStage]}
        </p>
        {isWalking && (
          <p className="text-xs text-green-500 mt-1 animate-pulse font-light">
            Walking...
          </p>
        )}
      </div>
    </div>
  );
}
