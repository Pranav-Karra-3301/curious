#!/usr/bin/env node

/**
 * Verify Rotation Script
 *
 * Verifies that the rotation completed successfully
 * and the database is in a valid state.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
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
    console.warn(`[Verify] Warning: Multiple current questions found (${current.length})`);
  }

  console.log(`[Verify] Current question: "${current[0].question.substring(0, 50)}..."`);
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
    console.log(`[Verify] Next question ready: "${next[0].question.substring(0, 50)}..."`);
  }

  // Check for any orphaned questions (both current and next)
  const { data: orphaned } = await supabase
    .from('questions')
    .select('id')
    .eq('is_current', true)
    .eq('is_next', true);

  if (orphaned && orphaned.length > 0) {
    console.warn(`[Verify] Warning: Found ${orphaned.length} questions marked as both current and next`);
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
