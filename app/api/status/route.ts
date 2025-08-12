import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function checkOpenAI(): Promise<'working' | 'fallback' | 'error'> {
  if (!process.env.OPENAI_API_KEY) {
    return 'fallback'
  }
  
  try {
    // Simple check - if API key exists and is properly formatted
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey && apiKey.startsWith('sk-') && apiKey.length > 20) {
      return 'working'
    }
    return 'fallback'
  } catch (error) {
    console.error('OpenAI status check error:', error)
    return 'error'
  }
}

async function checkSupabase(): Promise<'working' | 'fallback' | 'error'> {
  try {
    // Try to query the questions table
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('id')
      .limit(1)
    
    if (error) {
      console.error('Supabase query error:', error)
      return 'fallback'
    }
    
    return 'working'
  } catch (error) {
    console.error('Supabase status check error:', error)
    return 'error'
  }
}

export async function GET() {
  try {
    const [openaiStatus, supabaseStatus] = await Promise.all([
      checkOpenAI(),
      checkSupabase()
    ])
    
    return NextResponse.json({
      openai: openaiStatus,
      supabase: supabaseStatus,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Status check failed:', error)
    return NextResponse.json({
      openai: 'error',
      supabase: 'error',
      timestamp: new Date().toISOString()
    })
  }
}