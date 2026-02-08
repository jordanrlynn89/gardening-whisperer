import type { JourneyStage } from '@/components/GardenJourney';

/**
 * Get background gradient CSS classes based on journey progress stage.
 */
export function getBackgroundGradient(stage: JourneyStage): string {
  switch (stage) {
    case 'start':
      return 'from-stone-900/80 via-transparent to-stone-900/90'; // neutral
    case 'plant_id':
      return 'from-emerald-950/50 via-transparent to-stone-900/90'; // slight green tint
    case 'symptoms':
      return 'from-stone-900/80 via-stone-800/40 to-stone-900/90'; // slight warmth
    case 'environment':
      return 'from-emerald-950/40 via-transparent to-stone-900/90'; // more green
    case 'care_history':
      return 'from-emerald-950/50 via-emerald-900/20 to-stone-900/90'; // stronger green
    case 'complete':
      return 'from-amber-950/30 via-emerald-950/20 to-amber-950/20'; // celebration warmth
  }
}
