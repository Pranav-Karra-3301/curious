import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { supabaseAdmin } from '@/lib/supabase'

// Cache the response to prevent multiple simultaneous generations
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

function getCurrentHourTimestamp(): Date {
  const now = new Date()
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0)
  return currentHour
}

function getFallbackQuestion(usedQuestions: string[]): string {
  // Filter out already used questions
  const availableQuestions = fallbackQuestions.filter(q => !usedQuestions.includes(q))
  
  // If all questions have been used, reset (use all questions)
  const questionsToChooseFrom = availableQuestions.length > 0 ? availableQuestions : fallbackQuestions
  
  // Random selection instead of deterministic
  const index = Math.floor(Math.random() * questionsToChooseFrom.length)
  return questionsToChooseFrom[index]
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

async function generateNewQuestion(usedQuestions: string[]): Promise<string> {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    return getFallbackQuestion(usedQuestions)
  }

  const styleIndex = Math.floor(Math.random() * questionStyles.length)
  const topicIndex = Math.floor(Math.random() * questionTopics.length)
  const style = questionStyles[styleIndex]
  const topic = questionTopics[topicIndex]

  // Format used questions for the prompt
  const usedQuestionsList = usedQuestions.slice(-20).join('\n- ')

  try {
    const { text } = await generateText({
      model: openai('gpt-5-nano-2025-08-07'),
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
      console.log('Generated duplicate question, trying fallback')
      return getFallbackQuestion(usedQuestions)
    }

    return question
  } catch (error) {
    console.error('AI generation failed:', error)
    return getFallbackQuestion(usedQuestions)
  }
}

// In-memory cache to prevent race conditions
let generationInProgress: Promise<any> | null = null

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const currentOnly = url.searchParams.get('currentOnly') === '1'
    
    // Get the current hour timestamp
    const currentHour = getCurrentHourTimestamp()
    const currentHourISO = currentHour.toISOString()
    
    // First, check if we have a current question for this exact hour
    const { data: existingQuestions, error: fetchError } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('is_current', true)
      .gte('used_at', currentHourISO)
      .order('used_at', { ascending: false })
      .limit(1)
    
    if (!fetchError && existingQuestions && existingQuestions.length > 0) {
      const currentQuestion = existingQuestions[0]
      // Check if the question is from the current hour
      const questionHour = new Date(currentQuestion.used_at)
      questionHour.setMinutes(0, 0, 0)
      
      if (questionHour.getTime() === currentHour.getTime()) {
        console.log('Serving existing question for current hour')
        return NextResponse.json({ 
          question: currentQuestion.question,
          source: 'database',
          createdAt: currentQuestion.created_at,
          hourTimestamp: currentHourISO
        })
      }
    }
    
    // If caller only wants the current question, do not generate a new one
    if (currentOnly) {
      // Return the latest available "current" question even if it's from a previous hour
      const { data: latestCurrent, error: latestError } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_current', true)
        .order('used_at', { ascending: false })
        .limit(1)

      if (!latestError && latestCurrent && latestCurrent.length > 0) {
        return NextResponse.json({
          question: latestCurrent[0].question,
          source: 'database',
          createdAt: latestCurrent[0].created_at,
          hourTimestamp: currentHourISO
        })
      }

      return NextResponse.json({
        question: null,
        source: 'none',
        hourTimestamp: currentHourISO
      })
    }
    
    // If there's already a generation in progress, wait for it
    if (generationInProgress) {
      console.log('Waiting for existing generation to complete')
      await generationInProgress
      
      // Try fetching again after the generation completes
      const { data: newCheck, error: recheckError } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_current', true)
        .gte('used_at', currentHourISO)
        .single()
      
      if (!recheckError && newCheck) {
        return NextResponse.json({ 
          question: newCheck.question,
          source: 'database',
          createdAt: newCheck.created_at,
          hourTimestamp: currentHourISO
        })
      }
    }
    
    // Start generation and store the promise
    generationInProgress = (async () => {
      try {
        console.log('Generating new question for hour:', currentHourISO)
        
        // Get all previously used questions to avoid repetition
        const usedQuestions = await getUsedQuestions()
        
        // Generate new question
        const newQuestionText = await generateNewQuestion(usedQuestions)
        
        // Mark all current questions as not current
        await supabaseAdmin
          .from('questions')
          .update({ is_current: false })
          .eq('is_current', true)
        
        // Store the new question in the database with the exact hour timestamp
        const { data: newQuestion, error: insertError } = await supabaseAdmin
          .from('questions')
          .insert({
            question: newQuestionText,
            used_at: currentHourISO,
            is_current: true
          })
          .select()
          .single()
        
        if (insertError) {
          console.error('Error inserting question:', insertError)
          // Return the question anyway, just won't be saved
          return { 
            question: newQuestionText,
            source: process.env.OPENAI_API_KEY ? 'ai' : 'fallback',
            error: 'Failed to save to database',
            hourTimestamp: currentHourISO
          }
        }
        
        return {
          question: newQuestion.question,
          source: process.env.OPENAI_API_KEY ? 'ai' : 'fallback',
          createdAt: newQuestion.created_at,
          hourTimestamp: currentHourISO
        }
      } finally {
        // Clear the generation lock after a short delay
        setTimeout(() => {
          generationInProgress = null
        }, 1000)
      }
    })()
    
    const result = await generationInProgress
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error in GET handler:', error)
    // Emergency fallback
    const emergencyQuestion = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)]
    return NextResponse.json({ 
      question: emergencyQuestion,
      source: 'emergency-fallback',
      error: 'Service temporarily unavailable',
      hourTimestamp: getCurrentHourTimestamp().toISOString()
    })
  }
}

// Keep POST endpoint for compatibility
export async function POST(request: Request) {
  return GET(request)
}