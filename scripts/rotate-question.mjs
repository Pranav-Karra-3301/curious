#!/usr/bin/env node

/**
 * Daily Question Rotation Script
 *
 * This script is run by GitHub Actions at midnight EST.
 * It handles rotating the current question and ensuring
 * the next day's question is ready.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Configuration
const TIMEZONE = 'America/New_York';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Question generation configuration
const questionStyles = [
  "philosophical", "ethical", "scientific", "psychological",
  "existential", "social", "technological", "personal",
  "abstract", "practical", "humorous", "whimsical",
  "hypothetical", "introspective", "paradoxical"
];

const questionTopics = [
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

// Seasonal and day-based variations for better randomization
const seasonalThemes = {
  winter: ['reflection', 'warmth', 'inner life', 'rest', 'hope'],
  spring: ['growth', 'renewal', 'beginnings', 'change', 'potential'],
  summer: ['freedom', 'adventure', 'energy', 'joy', 'exploration'],
  fall: ['harvest', 'wisdom', 'gratitude', 'transition', 'preparation']
};

function getSeason(date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function getDayMood(dayOfWeek) {
  const moods = {
    0: 'reflective and peaceful',
    1: 'fresh and motivating',
    2: 'practical and grounded',
    3: 'creative and curious',
    4: 'deep and philosophical',
    5: 'playful and light',
    6: 'adventurous and open'
  };
  return moods[dayOfWeek] || 'thoughtful';
}

// Get current date in EST
function getCurrentESTDate() {
  const now = new Date();
  const estString = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  return estString; // Returns YYYY-MM-DD
}

// Get used questions for duplicate prevention
async function getUsedQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select('question')
    .not('used_at', 'is', null)
    .order('used_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching used questions:', error);
    return [];
  }

  return data?.map(q => q.question) || [];
}

// Generate a new question using OpenAI
async function generateQuestion(usedQuestions = [], attemptNumber = 0) {
  const now = new Date();
  const season = getSeason(now);
  const dayMood = getDayMood(now.getDay());
  const seasonThemes = seasonalThemes[season];

  // Enhanced randomization using multiple entropy sources
  const dateSeed = now.getDate() + now.getMonth() * 31 + now.getFullYear();
  const styleIndex = (dateSeed + Math.floor(Math.random() * 1000)) % questionStyles.length;
  const topicIndex = (dateSeed * 7 + Math.floor(Math.random() * 1000)) % questionTopics.length;

  const style = questionStyles[styleIndex];
  const topic = questionTopics[topicIndex];
  const seasonalHint = seasonThemes[Math.floor(Math.random() * seasonThemes.length)];

  const recentQuestionsList = usedQuestions.slice(0, 20).map(q => `- ${q}`).join('\n');

  const prompt = `Generate a single thought-provoking question.

CONTEXT:
- Style: ${style}
- Topic: ${topic}
- Season: ${season} (theme hint: ${seasonalHint})
- Day mood: ${dayMood}

REQUIREMENTS:
- Be genuinely unique and surprising
- Avoid clichés and overused philosophical tropes
- The question should feel fresh and unexpected
- Between 10-30 words
- Not a simple yes/no question unless rhetorical
- Should spark genuine reflection

${recentQuestionsList ? `AVOID these recent questions:\n${recentQuestionsList}` : ''}

STYLE GUIDANCE for "${style}":
${style === 'humorous' ? 'Make it genuinely funny or absurd while still thought-provoking' : ''}
${style === 'whimsical' ? 'Make it playful and imaginative, like a child wondering about the world' : ''}
${style === 'hypothetical' ? 'Create an interesting "what if" scenario that challenges assumptions' : ''}
${style === 'introspective' ? 'Focus on personal self-reflection and inner exploration' : ''}
${style === 'paradoxical' ? 'Include an apparent contradiction that reveals deeper truth' : ''}
${!['humorous', 'whimsical', 'hypothetical', 'introspective', 'paradoxical'].includes(style) ? 'Challenge assumptions or spark deep reflection' : ''}

Return ONLY the question text, no quotes or extra formatting.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.95,
    max_tokens: 100
  });

  let question = completion.choices[0].message.content.trim();

  // Clean up the question
  question = question.replace(/^["']|["']$/g, '').replace(/\?+$/, '?');

  // Validate
  if (question.length < 10 || question.length > 200) {
    if (attemptNumber < 3) {
      console.log(`Invalid question length (${question.length}), retrying... (attempt ${attemptNumber + 1})`);
      return generateQuestion(usedQuestions, attemptNumber + 1);
    }
    throw new Error(`Invalid question length after 3 attempts`);
  }

  // Check for duplicates
  if (usedQuestions.includes(question)) {
    if (attemptNumber < 3) {
      console.log(`Generated duplicate, retrying... (attempt ${attemptNumber + 1})`);
      return generateQuestion(usedQuestions, attemptNumber + 1);
    }
    throw new Error(`Duplicate question after 3 attempts`);
  }

  return {
    text: question,
    style,
    topic,
    season
  };
}

// Main rotation logic
async function rotateQuestion() {
  const today = getCurrentESTDate();
  console.log(`[Rotation] Starting for ${today}`);

  // Step 1: Get the current question
  const { data: currentQuestion } = await supabase
    .from('questions')
    .select('*')
    .eq('is_current', true)
    .single();

  // Step 2: Get the next question (should become current)
  const { data: nextQuestion } = await supabase
    .from('questions')
    .select('*')
    .eq('is_next', true)
    .single();

  // Step 3: If we have a next question, promote it to current
  if (nextQuestion) {
    // Clear current flag from old question
    if (currentQuestion) {
      await supabase
        .from('questions')
        .update({ is_current: false })
        .eq('id', currentQuestion.id);
      console.log(`[Rotation] Archived previous question: "${currentQuestion.question.substring(0, 40)}..."`);
    }

    // Promote next to current
    const { error: updateError } = await supabase
      .from('questions')
      .update({
        is_current: true,
        is_next: false,
        used_at: new Date().toISOString()
      })
      .eq('id', nextQuestion.id);

    if (updateError) {
      throw new Error(`Failed to promote next question: ${updateError.message}`);
    }

    console.log(`[Rotation] Promoted question: "${nextQuestion.question.substring(0, 40)}..."`);
  } else {
    console.log('[Rotation] No next question found, generating emergency question...');

    const usedQuestions = await getUsedQuestions();
    const newQuestion = await generateQuestion(usedQuestions);

    // Clear any current flags
    await supabase
      .from('questions')
      .update({ is_current: false })
      .eq('is_current', true);

    // Insert emergency question as current
    const { error: insertError } = await supabase
      .from('questions')
      .insert({
        question: newQuestion.text,
        is_current: true,
        is_next: false,
        used_at: new Date().toISOString()
      });

    if (insertError) {
      throw new Error(`Failed to insert emergency question: ${insertError.message}`);
    }

    console.log(`[Rotation] Created emergency question: "${newQuestion.text.substring(0, 40)}..."`);
  }

  // Step 4: Generate new next question
  console.log('[Rotation] Generating tomorrow\'s question...');

  const usedQuestions = await getUsedQuestions();
  const tomorrowQuestion = await generateQuestion(usedQuestions);

  const { error: nextInsertError } = await supabase
    .from('questions')
    .insert({
      question: tomorrowQuestion.text,
      is_current: false,
      is_next: true,
      used_at: null
    });

  if (nextInsertError) {
    console.error('[Rotation] Warning: Failed to generate next question:', nextInsertError.message);
    // Don't throw - rotation succeeded, next gen is secondary
  } else {
    console.log(`[Rotation] Generated next question: "${tomorrowQuestion.text.substring(0, 40)}..."`);
  }

  console.log('[Rotation] Complete!');
}

// Run
rotateQuestion()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Rotation] FAILED:', error);
    process.exit(1);
  });
