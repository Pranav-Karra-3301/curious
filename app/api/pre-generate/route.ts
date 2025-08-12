import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Fallback questions for when AI is not available
const fallbackQuestions = [
  "What assumptions about the world do you hold that you've never questioned?",
  "If you could know the exact date of your death, would you want to?",
  "Is it possible to be truly objective about anything you personally experience?",
  "What would happen to your sense of self if all your memories were gradually replaced?",
  "Do you think free will exists, or are we just very complex biological machines?",
  "If consciousness could be transferred to a machine, would it still be you?",
  "What makes something morally right or wrong beyond cultural agreement?",
  "Is there a difference between existing and being perceived to exist?",
  "What would you do if you discovered your entire life was a simulation?",
  "Can you ever truly know another person, or only your interpretation of them?",
  "What if the universe ended the moment you stopped observing it?",
  "How do you know your memories are real and not implanted five minutes ago?",
  "Why do we find beauty in things that serve no evolutionary purpose?",
  "If everyone forgot you existed, would you still be the same person?",
  "What's the difference between a very sophisticated chatbot and consciousness?",
  "Could you be happy if you knew it was artificially induced?",
  "Is mathematics discovered or invented by humans?",
  "What would change if you found out everyone else was a philosophical zombie?",
  "How many of your beliefs would survive if you had to prove them from scratch?",
  "If you could eliminate all suffering, but also all joy, would you?",
]

function getNextHourTimestamp(): Date {
  const now = new Date()
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0)
  return nextHour
}

function getFallbackQuestion(targetHour: Date): string {
  // Use deterministic selection based on hour timestamp to avoid flipping
  const hoursSinceEpoch = Math.floor(targetHour.getTime() / (1000 * 60 * 60))
  const index = hoursSinceEpoch % fallbackQuestions.length
  return fallbackQuestions[index]
}

const questionStyles = [
  "philosophical",
  "ethical", 
  "scientific",
  "psychological",
  "existential",
  "social",
  "technological",
  "personal",
  "abstract",
  "practical"
]

const questionTopics = [
  "consciousness and identity",
  "morality and ethics",
  "reality and perception", 
  "time and mortality",
  "knowledge and truth",
  "society and culture",
  "technology and humanity",
  "purpose and meaning",
  "free will and determinism",
  "love and relationships"
]

async function getUsedQuestions(): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('question')
      .not('used_at', 'is', null)
    
    if (error) {
      console.error('Error fetching used questions:', error)
      return []
    }
    
    return data?.map(q => q.question) || []
  } catch (error) {
    console.error('Error in getUsedQuestions:', error)
    return []
  }
}

async function generateNewQuestion(usedQuestions: string[], targetHour: Date): Promise<string> {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    return getFallbackQuestion(targetHour)
  }

  // Use deterministic selection based on hour for consistency
  const hoursSinceEpoch = Math.floor(targetHour.getTime() / (1000 * 60 * 60))
  const styleIndex = hoursSinceEpoch % questionStyles.length
  const topicIndex = (hoursSinceEpoch * 7) % questionTopics.length // Use different multiplier for topic
  const style = questionStyles[styleIndex]
  const topic = questionTopics[topicIndex]

  // Format used questions for the prompt
  const usedQuestionsList = usedQuestions.slice(-20).join('\n- ')

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0.95,
      prompt: `Generate a single ${style} thought-provoking question about ${topic}. 
      
The question should:
- Be unique and not commonly asked
- Challenge assumptions or spark deep reflection
- Be between 10-30 words
- Not be a yes/no question
- Feel fresh and unexpected
- Be DIFFERENT from these recently used questions:
${usedQuestionsList ? `- ${usedQuestionsList}` : '(no previous questions)'}

Examples of good questions:
- "If all your memories were fiction, would your identity still be real?"
- "Why do we trust our future selves to honor our current decisions?"
- "Does a thought exist before you think it, or only while thinking?"
- "What separates a deeply held belief from a comfortable delusion?"
- "If nobody remembered your kindness, would it still have happened?"

Return only the question text, no quotes or extra formatting.`
    })

    const question = text.trim().replace(/^["']|["']$/g, '').replace(/\?+$/, '?')
    
    // Basic validation
    if (question.length < 10 || question.length > 200) {
      throw new Error('Invalid question length')
    }

    // Check if this exact question was already used
    if (usedQuestions.includes(question)) {
      console.log('Generated duplicate question, using fallback')
      return getFallbackQuestion(targetHour)
    }

    return question
  } catch (error) {
    console.error('AI generation failed:', error)
    return getFallbackQuestion(targetHour)
  }
}

// Check if pre-generation is needed
export async function GET() {
  try {
    const now = new Date()
    const nextHour = getNextHourTimestamp()
    const minutesToNextHour = Math.floor((nextHour.getTime() - now.getTime()) / (1000 * 60))
    
    console.log(`Minutes to next hour: ${minutesToNextHour}`)
    
    // Only pre-generate if we're within 5 minutes of the next hour
    if (minutesToNextHour > 5) {
      return NextResponse.json({ 
        status: 'not_needed',
        message: `Too early to pre-generate. ${minutesToNextHour} minutes until next hour.`,
        nextHour: nextHour.toISOString()
      })
    }
    
    // Check if we already have a question ready for the next hour
    const { data: existingQuestion, error: fetchError } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('used_at', nextHour.toISOString())
      .single()
    
    if (!fetchError && existingQuestion) {
      return NextResponse.json({
        status: 'already_exists',
        message: 'Question for next hour already exists',
        question: existingQuestion.question,
        nextHour: nextHour.toISOString()
      })
    }
    
    console.log('Pre-generating question for next hour:', nextHour.toISOString())
    
    // Get used questions for uniqueness check
    const usedQuestions = await getUsedQuestions()
    
    // Generate new question for the next hour
    const newQuestionText = await generateNewQuestion(usedQuestions, nextHour)
    
    // Store the question for the next hour (but don't mark as current yet)
    const { data: newQuestion, error: insertError } = await supabaseAdmin
      .from('questions')
      .insert({
        question: newQuestionText,
        used_at: nextHour.toISOString(),
        is_current: false // Will be marked as current when the hour arrives
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Error inserting pre-generated question:', insertError)
      return NextResponse.json({
        status: 'error',
        message: 'Failed to save pre-generated question',
        error: insertError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'generated',
      message: 'Successfully pre-generated question for next hour',
      question: newQuestion.question,
      nextHour: nextHour.toISOString(),
      source: process.env.OPENAI_API_KEY ? 'ai' : 'fallback'
    })
    
  } catch (error) {
    console.error('Error in pre-generation:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Pre-generation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
