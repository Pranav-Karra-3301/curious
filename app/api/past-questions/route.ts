import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all questions that have been used (have a used_at date)
    // and are not the current question
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('id, question, used_at')
      .not('used_at', 'is', null)
      .eq('is_current', false)
      .order('used_at', { ascending: false })
      .limit(100) // Limit to last 100 questions for performance

    if (error) {
      console.error('Error fetching past questions:', error)
      return NextResponse.json({ error: 'Failed to load past questions' }, { status: 500 })
    }

    // Filter out any questions with invalid dates or duplicates
    const uniqueQuestions = data?.filter((q, index, self) => {
      const date = new Date(q.used_at)
      return !isNaN(date.getTime()) && 
        index === self.findIndex(item => item.used_at === q.used_at)
    }) || []

    return NextResponse.json({ questions: uniqueQuestions })
  } catch (error) {
    console.error('Error in past-questions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}