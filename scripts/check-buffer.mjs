#!/usr/bin/env node

/**
 * Check Buffer Status Script
 *
 * Reports on the current state of the question buffer.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBuffer() {
  const targetSize = parseInt(process.env.BUFFER_SIZE || '7');

  console.log('[Buffer Check] Analyzing buffer status...');

  // Count questions that are ready to be used (not used yet, not current, not next)
  const { data: bufferQuestions, error } = await supabase
    .from('questions')
    .select('*')
    .is('used_at', null)
    .eq('is_current', false)
    .eq('is_next', false);

  if (error) {
    throw new Error(`Failed to check buffer: ${error.message}`);
  }

  const bufferCount = bufferQuestions?.length || 0;
  const needed = Math.max(0, targetSize - bufferCount);

  console.log(`[Buffer Check] Current buffer: ${bufferCount}`);
  console.log(`[Buffer Check] Target size: ${targetSize}`);
  console.log(`[Buffer Check] Questions needed: ${needed}`);

  // Check next question
  const { data: next } = await supabase
    .from('questions')
    .select('*')
    .eq('is_next', true);

  if (next && next.length > 0) {
    console.log(`[Buffer Check] Next question ready: YES`);
  } else {
    console.log(`[Buffer Check] Next question ready: NO (will be generated during rotation)`);
  }

  // Output for GitHub Actions
  console.log(`::set-output name=buffer_count::${bufferCount}`);
  console.log(`::set-output name=needed::${needed}`);

  return { bufferCount, needed };
}

checkBuffer()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Buffer Check] FAILED:', error);
    process.exit(1);
  });
