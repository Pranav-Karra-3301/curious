/**
 * Shared configuration for question generation
 * Used by rotate-question.mjs and generate-buffer.mjs
 */

export const questionStyles = [
  "philosophical", "ethical", "scientific", "psychological",
  "existential", "social", "technological", "personal",
  "abstract", "practical", "humorous", "whimsical",
  "hypothetical", "introspective", "paradoxical"
];

export const questionTopics = [
  "consciousness and identity", "morality and ethics",
  "reality and perception", "time and mortality",
  "knowledge and truth", "society and culture",
  "technology and humanity", "purpose and meaning",
  "free will and determinism", "love and relationships",
  "creativity and imagination", "happiness and fulfillment",
  "memory and nostalgia", "dreams and aspirations",
  "humor and absurdity", "everyday life mysteries",
  "human quirks and habits", "nature and existence",
  "communication and language", "childhood and growing up"
];

// Seasonal themes aligned with PRODUCTION_PLAN.md
export const seasonalThemes = {
  winter: ['introspection', 'warmth', 'endings', 'rest', 'reflection'],
  spring: ['growth', 'renewal', 'beginnings', 'hope', 'change'],
  summer: ['freedom', 'adventure', 'energy', 'joy', 'exploration'],
  fall: ['harvest', 'wisdom', 'gratitude', 'transition', 'preparation']
};

// Constants for better maintainability
export const MAX_LOG_LENGTH = 40;
export const OPENAI_MODEL = 'gpt-4o-mini';
export const OPENAI_TEMPERATURE = 0.8; // Balanced creativity with coherence
export const OPENAI_MAX_TOKENS = 100;
export const QUESTION_MIN_LENGTH = 10;
export const QUESTION_MAX_LENGTH = 200;
export const MAX_RETRY_ATTEMPTS = 3;
export const GENERATION_DELAY_MS = parseInt(process.env.GENERATION_DELAY_MS || '2000'); // Configurable delay to avoid rate limits

/**
 * Normalize text for duplicate comparison (case-insensitive, punctuation/whitespace-insensitive)
 */
export function normalizeForComparison(text) {
  return text
    .toLowerCase()
    .trim()
    // Normalize curly quotes to straight equivalents
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove most punctuation characters (hyphen at end to avoid range interpretation)
    .replace(/[!"#$%&'()*+,/:;<=>?@[\\\]^_`{|}~.-]/g, '')
    // Collapse multiple whitespace characters into a single space
    .replace(/\s+/g, ' ');
}

/**
 * Validate environment variables
 */
export function validateEnvVars(requiredVars) {
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Get Supabase URL with fallback support for both naming conventions
 */
export function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}
