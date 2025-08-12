#!/usr/bin/env node

// Script to set up Supabase database tables
// Run this once to create the necessary tables and functions

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('Setting up Supabase database...')
  
  try {
    // Create questions table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS questions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          question TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          used_at TIMESTAMP WITH TIME ZONE,
          is_current BOOLEAN DEFAULT FALSE
        );
      `
    }).single()
    
    if (tableError && !tableError.message.includes('already exists')) {
      // Try alternative approach - direct SQL execution
      console.log('Using alternative table creation method...')
      
      // Note: Supabase doesn't allow direct DDL through the client library
      // You'll need to run the SQL in the Supabase dashboard
      console.log('\n===========================================')
      console.log('Please run the following SQL in your Supabase SQL editor:')
      console.log('(Go to https://supabase.com/dashboard/project/tqxhyjqxvxqscrjkmdwf/sql/new)')
      console.log('===========================================\n')
      console.log(`
-- Create questions table to store all generated questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_questions_is_current ON questions(is_current);
CREATE INDEX IF NOT EXISTS idx_questions_used_at ON questions(used_at);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);

-- Enable Row Level Security
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous reads" ON questions;
DROP POLICY IF EXISTS "Allow service role writes" ON questions;

-- Create policy to allow anonymous reads
CREATE POLICY "Allow anonymous reads" ON questions
  FOR SELECT
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role writes" ON questions
  FOR ALL
  USING (auth.role() = 'service_role');
      `)
      console.log('\n===========================================\n')
      return
    }
    
    console.log('✅ Database setup complete!')
    
    // Test the connection
    const { data, error } = await supabase
      .from('questions')
      .select('count')
      .single()
    
    if (error) {
      console.log('⚠️  Table exists but couldn\'t query it. You may need to run the SQL manually.')
    } else {
      console.log('✅ Successfully connected to the questions table')
    }
    
  } catch (error) {
    console.error('Error setting up database:', error)
    console.log('\nPlease run the SQL script manually in the Supabase dashboard.')
  }
}

setupDatabase()