import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('id, question, used_at')
      .not('used_at', 'is', null)
      .eq('is_current', false)
      .order('used_at', { ascending: false })

    if (error) {
      console.error('Error fetching past questions:', error)
      return NextResponse.json({ error: 'Failed to load past questions' }, { status: 500 })
    }

    return NextResponse.json({ questions: data || [] })
  } catch (error) {
    console.error('Error in past-questions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}