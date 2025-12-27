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
import {
  questionStyles,
  questionTopics,
  seasonalThemes,
  MAX_LOG_LENGTH,
  OPENAI_MODEL,
  OPENAI_TEMPERATURE,
  OPENAI_MAX_TOKENS,
  QUESTION_MIN_LENGTH,
  QUESTION_MAX_LENGTH,
  MAX_RETRY_ATTEMPTS,
  normalizeForComparison,
  validateEnvVars,
  getSupabaseUrl
} from './lib/question-config.mjs';

// Configuration
const TIMEZONE = 'America/New_York';

// Validate required environment variables
validateEnvVars(['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']);

const supabaseUrl = getSupabaseUrl();
if (!supabaseUrl) {
  throw new Error(
    'Environment variable SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required but was not set'
  );
}

// Initialize clients
const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: OPENAI_TEMPERATURE,
    max_tokens: OPENAI_MAX_TOKENS
  });

  let question = completion.choices[0].message.content.trim();

  // Clean up the question
  question = question.replace(/^["']|["']$/g, '').replace(/\?+$/, '?');

  // Normalize for duplicate comparison (case-insensitive, punctuation/whitespace-insensitive)
  const normalizedQuestion = normalizeForComparison(question);
  const normalizedUsedQuestions = Array.isArray(usedQuestions)
    ? usedQuestions.map((q) => normalizeForComparison(q))
    : [];

  // Validate
  if (question.length < QUESTION_MIN_LENGTH || question.length > QUESTION_MAX_LENGTH) {
    throw new Error(`Invalid question length: ${question.length}`);
  }

  // Check for duplicates (using normalized comparison)
  if (normalizedUsedQuestions.includes(normalizedQuestion)) {
    if (attemptNumber < MAX_RETRY_ATTEMPTS) {
      console.log(`Generated duplicate on attempt ${attemptNumber + 1}, retrying...`);
      return generateQuestion(usedQuestions, attemptNumber + 1);
    }
    throw new Error(`Duplicate question after ${attemptNumber} attempts`);
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
  const { data: currentQuestion, error: currentQuestionError } = await supabase
    .from('questions')
    .select('*')
    .eq('is_current', true)
    .maybeSingle();

  if (currentQuestionError) {
    throw new Error(`Failed to fetch current question: ${currentQuestionError.message}`);
  }

  // Step 2: Get the next question (should become current)
  const { data: nextQuestion, error: nextQuestionError } = await supabase
    .from('questions')
    .select('*')
    .eq('is_next', true)
    .maybeSingle();

  if (nextQuestionError) {
    throw new Error(`Failed to fetch next question: ${nextQuestionError.message}`);
  }

  // Step 3: If we have a next question, promote it to current
  if (nextQuestion) {
    // Clear current flag from old question
    if (currentQuestion) {
      await supabase
        .from('questions')
        .update({ is_current: false })
        .eq('id', currentQuestion.id);
      console.log(`[Rotation] Archived previous question: "${currentQuestion.question.substring(0, MAX_LOG_LENGTH)}..."`);
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

    console.log(`[Rotation] Promoted question: "${nextQuestion.question.substring(0, MAX_LOG_LENGTH)}..."`);
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

    console.log(`[Rotation] Created emergency question: "${newQuestion.text.substring(0, MAX_LOG_LENGTH)}..."`);
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
    console.error('[Rotation] DEGRADED STATE: Failed to insert next (tomorrow\'s) question.');
    console.error('[Rotation] Next question insert error message:', nextInsertError.message);
    console.error('[Rotation] Next question insert error details:', JSON.stringify(nextInsertError, null, 2));
    console.error('[Rotation] Note: Rotation of current question succeeded, but no next question is queued.');
    // Don't throw - rotation succeeded, next gen is secondary. This is a partial failure for monitoring.
  } else {
    console.log(`[Rotation] Generated next question: "${tomorrowQuestion.text.substring(0, MAX_LOG_LENGTH)}..."`);
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
