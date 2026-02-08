import { extractPlantName } from './plantExtraction';
import { extractStageSummary } from './stageDetection';

export interface SummaryData {
  plantName: string;
  plantIdentified: string;
  symptomsNoted: string;
  environmentReviewed: string;
  careHistoryDiscussed: string;
  diagnosisGiven: string;
  careRecommendations: {
    light: string;
    lightDetail: string;
    water: string;
    waterDetail: string;
    temp: string;
    tempDetail: string;
  };
}

/**
 * Get care recommendations based on plant type.
 */
export function getCareRecommendations(plantName: string): SummaryData['careRecommendations'] {
  const lower = plantName.toLowerCase();

  // Vegetables
  if (lower.includes('tomato')) {
    return { light: 'Full Sun', lightDetail: '6-8h/day', water: 'Regular', waterDetail: '1-2"/week', temp: '70-85°F', tempDetail: 'Warm' };
  }
  if (lower.includes('pepper')) {
    return { light: 'Full Sun', lightDetail: '6-8h/day', water: 'Moderate', waterDetail: '1"/week', temp: '70-80°F', tempDetail: 'Warm' };
  }
  if (lower.includes('lettuce') || lower.includes('basil') || lower.includes('mint')) {
    return { light: 'Part Sun', lightDetail: '4-6h/day', water: 'Regular', waterDetail: '1"/week', temp: '60-70°F', tempDetail: 'Cool' };
  }

  // Succulents & Cacti
  if (lower.includes('succulent') || lower.includes('cactus') || lower.includes('aloe')) {
    return { light: 'Bright', lightDetail: '6h/day', water: 'Low', waterDetail: 'Every 2wks', temp: '65-75°F', tempDetail: 'Warm' };
  }

  // Tropical houseplants
  if (lower.includes('monstera') || lower.includes('pothos') || lower.includes('philodendron')) {
    return { light: 'Bright Indirect', lightDetail: '4-6h/day', water: 'Moderate', waterDetail: 'Weekly', temp: '65-80°F', tempDetail: 'Warm' };
  }

  // Snake plant
  if (lower.includes('snake')) {
    return { light: 'Low-Bright', lightDetail: 'Flexible', water: 'Low', waterDetail: 'Every 2wks', temp: '60-80°F', tempDetail: 'Flexible' };
  }

  // Ferns
  if (lower.includes('fern')) {
    return { light: 'Indirect', lightDetail: '3-4h/day', water: 'High', waterDetail: 'Keep moist', temp: '60-75°F', tempDetail: 'Cool-Warm' };
  }

  // Herbs
  if (lower.includes('lavender') || lower.includes('rosemary')) {
    return { light: 'Full Sun', lightDetail: '6-8h/day', water: 'Low', waterDetail: 'Dry out', temp: '60-70°F', tempDetail: 'Cool' };
  }

  // Roses
  if (lower.includes('rose')) {
    return { light: 'Full Sun', lightDetail: '6h/day', water: 'Regular', waterDetail: '1-2"/week', temp: '60-75°F', tempDetail: 'Moderate' };
  }

  // Orchids
  if (lower.includes('orchid')) {
    return { light: 'Bright Indirect', lightDetail: '4-6h/day', water: 'Low', waterDetail: 'Weekly', temp: '65-80°F', tempDetail: 'Warm' };
  }

  // Default for unknown plants
  return { light: 'Bright', lightDetail: '4-6h/day', water: 'Moderate', waterDetail: 'Weekly', temp: '65-75°F', tempDetail: 'Moderate' };
}

/**
 * Generate complete summary data from conversation messages.
 */
export function generateSummaryData(messages: { role: string; content: string }[]): SummaryData {
  const plantName = extractPlantName(messages);

  return {
    plantName,
    plantIdentified: extractStageSummary(messages, 'plant_id'),
    symptomsNoted: extractStageSummary(messages, 'symptoms'),
    environmentReviewed: extractStageSummary(messages, 'environment'),
    careHistoryDiscussed: extractStageSummary(messages, 'care_history'),
    diagnosisGiven: extractStageSummary(messages, 'diagnosis'),
    careRecommendations: getCareRecommendations(plantName),
  };
}
