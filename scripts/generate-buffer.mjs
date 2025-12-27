#!/usr/bin/env node

/**
 * Generate Buffer Questions Script
 *
 * Maintains a buffer of pre-generated questions for reliability.
 * Run by GitHub Actions every 6 hours.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const BUFFER_SIZE = parseInt(process.env.BUFFER_SIZE || '7');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Question configuration (same as rotate script)
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

async function getUsedQuestions() {
  const { data } = await supabase
    .from('questions')
    .select('question')
    .order('created_at', { ascending: false })
    .limit(100);

  return data?.map(q => q.question) || [];
}

async function generateQuestion(usedQuestions, attemptNumber = 0) {
  // Use attempt number to vary the selection
  const seed = Date.now() + attemptNumber * 1337;
  const styleIndex = seed % questionStyles.length;
  const topicIndex = (seed * 7) % questionTopics.length;

  const style = questionStyles[styleIndex];
  const topic = questionTopics[topicIndex];

  const recentQuestionsList = usedQuestions.slice(0, 30).map(q => `- ${q}`).join('\n');

  const prompt = `Generate a unique thought-provoking question.

Style: ${style}
Topic: ${topic}

Requirements:
- Genuinely unique and surprising
- Avoid clichés
- 10-30 words
- Not a simple yes/no
- Spark genuine reflection

${recentQuestionsList ? `AVOID these questions:\n${recentQuestionsList}` : ''}

Return ONLY the question text.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.95,
    max_tokens: 100
  });

  let question = completion.choices[0].message.content.trim();
  question = question.replace(/^["']|["']$/g, '').replace(/\?+$/, '?');

  if (question.length < 10 || question.length > 200) {
    if (attemptNumber < 3) {
      return generateQuestion(usedQuestions, attemptNumber + 1);
    }
    throw new Error(`Invalid question length after ${attemptNumber} attempts`);
  }

  if (usedQuestions.includes(question)) {
    if (attemptNumber < 3) {
      return generateQuestion(usedQuestions, attemptNumber + 1);
    }
    throw new Error(`Duplicate question after ${attemptNumber} attempts`);
  }

  return { text: question, style, topic };
}

async function generateBuffer() {
  console.log(`[Buffer] Target size: ${BUFFER_SIZE}`);

  // Count existing buffer (unused, not current, not next)
  const { data: existing } = await supabase
    .from('questions')
    .select('*')
    .is('used_at', null)
    .eq('is_current', false)
    .eq('is_next', false);

  const currentCount = existing?.length || 0;
  const needed = Math.max(0, BUFFER_SIZE - currentCount);

  console.log(`[Buffer] Current count: ${currentCount}`);
  console.log(`[Buffer] Need to generate: ${needed}`);

  if (needed === 0) {
    console.log('[Buffer] Buffer is full, nothing to do.');
    return;
  }

  // Get all questions for duplicate checking
  let usedQuestions = await getUsedQuestions();

  let generated = 0;
  let failures = 0;

  for (let i = 0; i < needed && failures < 3; i++) {
    try {
      console.log(`[Buffer] Generating ${i + 1}/${needed}...`);

      const question = await generateQuestion(usedQuestions, 0);

      const { error } = await supabase
        .from('questions')
        .insert({
          question: question.text,
          is_current: false,
          is_next: false,
          used_at: null
        });

      if (error) {
        throw new Error(`Insert failed: ${error.message}`);
      }

      usedQuestions.push(question.text);
      generated++;

      console.log(`[Buffer] Generated: "${question.text.substring(0, 40)}..."`);

      // Small delay between generations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`[Buffer] Failed to generate question ${i + 1}:`, error.message);
      failures++;
    }
  }

  console.log(`[Buffer] Complete! Generated ${generated} questions, ${failures} failures.`);

  if (failures >= 3) {
    throw new Error(`Too many failures (${failures}), stopping buffer generation.`);
  }
}

generateBuffer()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Buffer] FAILED:', error);
    process.exit(1);
  });
