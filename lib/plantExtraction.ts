const KNOWN_PLANTS = [
  'snake plant', 'spider plant', 'tomato', 'basil', 'rose', 'orchid', 'succulent', 'fern',
  'cactus', 'monstera', 'pothos', 'aloe', 'lavender', 'mint', 'pepper', 'cucumber', 'lettuce',
  'strawberry', 'blueberry', 'hibiscus', 'sunflower', 'petunia', 'geranium', 'ivy', 'palm',
  'lily', 'daisy', 'marigold', 'zinnia', 'cilantro', 'parsley', 'thyme', 'sage', 'rosemary',
  'dill', 'chive', 'philodendron', 'rubber plant', 'jade plant', 'peace lily', 'dracaena',
  'ficus', 'boston fern', 'english ivy', 'bamboo', 'african violet', 'begonia', 'coleus',
  'dieffenbachia', 'schefflera', 'croton', 'calathea', 'maranta', 'prayer plant', 'zz plant',
  'hoya', 'string of pearls', 'anthurium', 'bromeliad', 'syngonium', 'arrowhead plant',
  'avocado', 'lemon', 'lime', 'orange', 'mango', 'papaya', 'banana', 'fig', 'olive', 'grape',
  'cherry', 'apple', 'pear', 'peach', 'plum', 'pomegranate', 'guava', 'passionfruit',
  'watermelon', 'cantaloupe', 'squash', 'zucchini', 'pumpkin', 'corn', 'bean', 'pea',
  'carrot', 'onion', 'garlic', 'potato', 'sweet potato', 'beet', 'radish', 'turnip',
  'spinach', 'kale', 'arugula', 'chard', 'cabbage', 'broccoli', 'cauliflower', 'celery',
  'asparagus', 'artichoke', 'eggplant', 'okra', 'jalapeño', 'habanero', 'serrano',
  'gardenia', 'jasmine', 'hydrangea', 'azalea', 'rhododendron', 'camellia', 'magnolia',
  'wisteria', 'clematis', 'bougainvillea', 'plumeria', 'bird of paradise', 'heliconia',
  'poinsettia', 'amaryllis', 'tulip', 'daffodil', 'hyacinth', 'crocus', 'iris', 'peony',
  'dahlia', 'chrysanthemum', 'aster', 'cosmos', 'poppy', 'snapdragon', 'foxglove',
  'lemongrass', 'oregano', 'tarragon', 'chamomile', 'bay laurel', 'chives',
  'fiddle leaf fig', 'money tree', 'chinese evergreen', 'cast iron plant', 'air plant',
  'aloe vera', 'christmas cactus', 'string of hearts', 'wandering jew', 'tradescantia',
];

// Sort by length descending so multi-word names (e.g. "peace lily") match before
// their single-word substrings (e.g. "lily")
KNOWN_PLANTS.sort((a, b) => b.length - a.length);

export { KNOWN_PLANTS };

/**
 * Extract plant name from conversation messages.
 * Checks AI photo-based identification, known plant names, AI confirmation patterns,
 * and user-mentioned plant names in priority order.
 */
export function extractPlantName(messages: { role: string; content: string }[]): string {
  // Priority 1: Check AI photo-based identification patterns (most authoritative)
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    const photoPatterns = [
      /(?:this is|appears to be|looks like|i can see|from the photo.*?it's|i'd identify this as|this seems to be)\s+(?:a|an)\s+([a-z][a-z ]{2,30}?)(?:\s+plant)?[.,!?\s]/i,
      /(?:identified|identifying|recognize|recognized)\s+(?:this|it)\s+as\s+(?:a|an)\s+([a-z][a-z ]{2,30}?)(?:\s+plant)?[.,!?\s]/i,
    ];

    for (const pattern of photoPatterns) {
      const match = msg.content.match(pattern);
      if (match) {
        const name = match[1].trim().toLowerCase();
        const skip = ['healthy', 'sick', 'beautiful', 'lovely', 'common', 'popular', 'indoor', 'outdoor', 'tropical', 'good', 'nice'];
        if (!skip.includes(name)) {
          return name.replace(/\b\w/g, c => c.toUpperCase());
        }
      }
    }
  }

  // Priority 2: Check known plant names across ALL messages
  for (const msg of messages) {
    const lower = msg.content.toLowerCase();
    for (const plant of KNOWN_PLANTS) {
      if (lower.includes(plant)) {
        return plant.replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  }

  // Priority 3: Check AI messages for general confirmation patterns
  const confirmPatterns = [
    /your\s+([a-z][a-z ]{2,20}?)(?:\s+plant|\s+bush|\s+tree|\s+vine)?[.,!?\s]/i,
    /(?:an?)\s+([a-z][a-z ]{2,20}?)\s+plant[.,!?\s]/i,
    /(?:the)\s+([a-z][a-z ]{2,20}?)\s+(?:plant|tree|bush|vine)[.,!?\s]/i,
  ];
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const pattern of confirmPatterns) {
      const confirmMatch = msg.content.match(pattern);
      if (confirmMatch) {
        const name = confirmMatch[1].trim().toLowerCase();
        const skip = ['got', 'the', 'that', 'this', 'good', 'great', 'nice', 'let', 'take', 'little', 'new', 'other', 'first', 'next', 'bottom', 'top', 'same', 'whole', 'entire', 'healthy', 'sick', 'indoor', 'outdoor'];
        if (!skip.includes(name)) {
          return name.replace(/\b\w/g, c => c.toUpperCase());
        }
      }
    }
  }

  // Priority 4: Check user messages for plant names they mention directly
  const userPlantPatterns = [
    /(?:it's|its|i have|i've got|my)\s+(?:a|an)?\s*([a-z][a-z ]{2,20}?)(?:\s+plant|\s+tree)?[.,!?\s]/i,
    /([a-z][a-z ]{2,20}?)\s+plant[.,!?\s]/i,
  ];
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    for (const pattern of userPlantPatterns) {
      const match = msg.content.match(pattern);
      if (match) {
        const name = match[1].trim().toLowerCase();
        const skip = ['the', 'a', 'an', 'my', 'this', 'that', 'little', 'small', 'big', 'new', 'old'];
        if (!skip.includes(name) && name.length > 2) {
          return name.replace(/\b\w/g, c => c.toUpperCase());
        }
      }
    }
  }

  return 'Your';
}
