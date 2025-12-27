#!/usr/bin/env node

/**
 * Verify Rotation Script
 *
 * Verifies that the rotation completed successfully
 * and the database is in a valid state.
 */

import { createClient } from '@supabase/supabase-js';
import { MAX_LOG_LENGTH, validateEnvVars, getSupabaseUrl } from './lib/question-config.mjs';

// Validate required environment variables
validateEnvVars(['SUPABASE_SERVICE_ROLE_KEY']);

const supabaseUrl = getSupabaseUrl();
if (!supabaseUrl) {
  throw new Error(
    'Environment variable SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required but was not set'
  );
}

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('[Verify] Checking database state...');

  // Check current question exists
  const { data: current, error: currentError } = await supabase
    .from('questions')
    .select('*')
    .eq('is_current', true);

  if (currentError) {
    throw new Error(`Failed to fetch current question: ${currentError.message}`);
  }

  if (!current || current.length === 0) {
    throw new Error('No current question found!');
  }

  if (current.length > 1) {
    throw new Error(`Multiple current questions found (${current.length})`);
  }

  console.log(`[Verify] Current question: "${current[0].question.substring(0, MAX_LOG_LENGTH)}..."`);
  console.log(`[Verify] Used at: ${current[0].used_at}`);

  // Check next question exists
  const { data: next, error: nextError } = await supabase
    .from('questions')
    .select('*')
    .eq('is_next', true);

  if (nextError) {
    throw new Error(`Failed to fetch next question: ${nextError.message}`);
  }

  if (!next || next.length === 0) {
    console.warn('[Verify] Warning: No next question found!');
  } else {
    console.log(`[Verify] Next question ready: "${next[0].question.substring(0, MAX_LOG_LENGTH)}..."`);
  }

  // Check for any orphaned questions (both current OR next - logically impossible but checks data integrity)
  const { data: orphaned } = await supabase
    .from('questions')
    .select('id')
    .eq('is_current', true)
    .eq('is_next', true);

  if (orphaned && orphaned.length > 0) {
    throw new Error(`Found ${orphaned.length} questions marked as both current and next`);
  }

  // Count total questions
  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true });

  console.log(`[Verify] Total questions in database: ${count}`);

  // Count used questions
  const { count: usedCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .not('used_at', 'is', null);

  console.log(`[Verify] Questions used so far: ${usedCount}`);

  console.log('[Verify] All checks passed!');
}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Verify] FAILED:', error);
    process.exit(1);
  });
