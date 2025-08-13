import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { supabaseAdmin } from '@/lib/supabase'

// Cache the response to prevent multiple simultaneous generations
export const dynamic = 'force-dynamic'
export const revalidate = 0

function getCurrentHourTimestamp(): Date {
  const now = new Date()
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0)
  return currentHour
}

function getNextHourTimestamp(): Date {
  const currentHour = getCurrentHourTimestamp()
  const nextHour = new Date(currentHour)
  nextHour.setHours(nextHour.getHours() + 1)
  return nextHour
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
    throw new Error('OpenAI API key not configured')
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
      console.log('Generated duplicate question, retrying...')
      // Retry with different parameters
      return generateNewQuestion(usedQuestions)
    }

    return question
  } catch (error) {
    console.error('AI generation failed:', error)
    throw error
  }
}

// In-memory cache to prevent race conditions
let generationInProgress: Promise<any> | null = null

async function ensureQuestionsExist() {
  const currentHour = getCurrentHourTimestamp()
  const nextHour = getNextHourTimestamp()
  const currentHourISO = currentHour.toISOString()
  const nextHourISO = nextHour.toISOString()
  
  // Check for existing current question
  const { data: currentQuestion } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('is_current', true)
    .single()
  
  // Check for existing next question
  const { data: nextQuestion } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('is_next', true)
    .single()
  
  const usedQuestions = await getUsedQuestions()
  
  // Generate current question if missing
  if (!currentQuestion) {
    console.log('Generating missing current question')
    const newCurrentText = await generateNewQuestion(usedQuestions)
    
    await supabaseAdmin
      .from('questions')
      .insert({
        question: newCurrentText,
        used_at: currentHourISO,
        is_current: true,
        is_next: false
      })
  }
  
  // Generate next question if missing
  if (!nextQuestion) {
    console.log('Generating missing next question')
    const updatedUsedQuestions = await getUsedQuestions()
    const newNextText = await generateNewQuestion(updatedUsedQuestions)
    
    await supabaseAdmin
      .from('questions')
      .insert({
        question: newNextText,
        used_at: null,
        is_current: false,
        is_next: true
      })
  }
}

async function rotateQuestions() {
  const currentHour = getCurrentHourTimestamp()
  const currentHourISO = currentHour.toISOString()
  
  // Get the next question that should become current
  const { data: nextQuestion, error: fetchError } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('is_next', true)
    .single()
  
  if (fetchError || !nextQuestion) {
    console.error('No next question found, generating emergency question')
    // Emergency generation
    const usedQuestions = await getUsedQuestions()
    const emergencyText = await generateNewQuestion(usedQuestions)
    
    // Clear old current questions
    await supabaseAdmin
      .from('questions')
      .update({ is_current: false })
      .eq('is_current', true)
    
    // Insert emergency question as current
    await supabaseAdmin
      .from('questions')
      .insert({
        question: emergencyText,
        used_at: currentHourISO,
        is_current: true,
        is_next: false
      })
    
    // Generate new next question
    const updatedUsedQuestions = await getUsedQuestions()
    const newNextText = await generateNewQuestion(updatedUsedQuestions)
    
    await supabaseAdmin
      .from('questions')
      .insert({
        question: newNextText,
        used_at: null,
        is_current: false,
        is_next: true
      })
    
    return emergencyText
  }
  
  // Rotate: next becomes current
  // First, mark all current as not current
  await supabaseAdmin
    .from('questions')
    .update({ is_current: false })
    .eq('is_current', true)
  
  // Update the next question to be current
  await supabaseAdmin
    .from('questions')
    .update({ 
      is_current: true,
      is_next: false,
      used_at: currentHourISO
    })
    .eq('id', nextQuestion.id)
  
  // Generate new next question
  const usedQuestions = await getUsedQuestions()
  const newNextText = await generateNewQuestion(usedQuestions)
  
  await supabaseAdmin
    .from('questions')
    .insert({
      question: newNextText,
      used_at: null,
      is_current: false,
      is_next: true
    })
  
  return nextQuestion.question
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    
    // Get both questions endpoint
    if (action === 'get-both') {
      const { data: currentQuestion } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_current', true)
        .single()
      
      const { data: nextQuestion } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_next', true)
        .single()
      
      return NextResponse.json({
        current: currentQuestion,
        next: nextQuestion,
        currentHourTimestamp: getCurrentHourTimestamp().toISOString(),
        nextHourTimestamp: getNextHourTimestamp().toISOString()
      })
    }
    
    // Rotate endpoint (called when hour changes)
    if (action === 'rotate') {
      // Prevent multiple simultaneous rotations
      if (generationInProgress) {
        await generationInProgress
      }
      
      generationInProgress = (async () => {
        try {
          const newCurrentText = await rotateQuestions()
          return { success: true, question: newCurrentText }
        } finally {
          setTimeout(() => {
            generationInProgress = null
          }, 1000)
        }
      })()
      
      const result = await generationInProgress
      return NextResponse.json(result)
    }
    
    // Initialize endpoint (ensure both questions exist)
    if (action === 'initialize') {
      await ensureQuestionsExist()
      
      const { data: currentQuestion } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_current', true)
        .single()
      
      const { data: nextQuestion } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_next', true)
        .single()
      
      return NextResponse.json({
        current: currentQuestion,
        next: nextQuestion,
        currentHourTimestamp: getCurrentHourTimestamp().toISOString(),
        nextHourTimestamp: getNextHourTimestamp().toISOString()
      })
    }
    
    // Default: get current question for backward compatibility
    const currentHour = getCurrentHourTimestamp()
    const currentHourISO = currentHour.toISOString()
    
    // Check if current question's hour matches actual current hour
    const { data: currentQuestion } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('is_current', true)
      .single()
    
    if (currentQuestion) {
      const questionHour = currentQuestion.used_at ? new Date(currentQuestion.used_at) : null
      if (questionHour) {
        questionHour.setMinutes(0, 0, 0)
        
        // If question is from current hour, return it
        if (questionHour.getTime() === currentHour.getTime()) {
          return NextResponse.json({
            question: currentQuestion.question,
            source: 'database',
            createdAt: currentQuestion.created_at,
            hourTimestamp: currentHourISO
          })
        }
        
        // Question is outdated, trigger rotation
        console.log('Current question is outdated, rotating...')
        const newQuestion = await rotateQuestions()
        return NextResponse.json({
          question: newQuestion,
          source: 'rotated',
          hourTimestamp: currentHourISO
        })
      }
    }
    
    // No current question, initialize
    await ensureQuestionsExist()
    const { data: newCurrent } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('is_current', true)
      .single()
    
    return NextResponse.json({
      question: newCurrent?.question || 'What makes you curious today?',
      source: 'initialized',
      hourTimestamp: currentHourISO
    })
    
  } catch (error) {
    console.error('Error in GET handler:', error)
    return NextResponse.json({ 
      question: 'What questions remain unasked in the spaces between our thoughts?',
      source: 'error-fallback',
      error: error instanceof Error ? error.message : 'Service temporarily unavailable',
      hourTimestamp: getCurrentHourTimestamp().toISOString()
    })
  }
}

// Keep POST endpoint for compatibility
export async function POST(request: Request) {
  return GET(request)
}