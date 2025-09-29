import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { supabaseAdmin } from '@/lib/supabase'
import { toZonedTime } from 'date-fns-tz'

// Cache the response to prevent multiple simultaneous generations
export const dynamic = 'force-dynamic'
export const revalidate = 0

function getCurrentDayTimestampEST(): Date {
  // Get current time in Eastern Time (handles EST/EDT automatically)
  const now = new Date()
  const timeZone = 'America/New_York'
  const easternTime = toZonedTime(now, timeZone)
  
  // Set to midnight Eastern Time for the current day
  const currentDay = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate(), 0, 0, 0, 0)
  return currentDay
}

function getNextDayTimestampEST(): Date {
  const currentDay = getCurrentDayTimestampEST()
  const nextDay = new Date(currentDay)
  nextDay.setDate(nextDay.getDate() + 1)
  return nextDay
}

function getTimeUntilNextDayEST(): number {
  // Get current time in Eastern Time (handles EST/EDT automatically)
  const now = new Date()
  const timeZone = 'America/New_York'
  const easternTime = toZonedTime(now, timeZone)
  
  const nextDay = getNextDayTimestampEST()
  return nextDay.getTime() - easternTime.getTime()
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
  "practical",
  "humorous",
  "whimsical",
  "hypothetical",
  "introspective",
  "paradoxical"
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
  "love and relationships",
  "creativity and imagination",
  "happiness and fulfillment",
  "memory and nostalgia",
  "dreams and aspirations",
  "humor and absurdity",
  "everyday life mysteries",
  "human quirks and habits",
  "nature and existence",
  "communication and language",
  "childhood and growing up"
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

  // Add variety to the prompt based on style
  const stylePrompts = {
    humorous: "Make it genuinely funny or absurd while still thought-provoking",
    whimsical: "Make it playful and imaginative",
    hypothetical: "Create an interesting 'what if' scenario",
    introspective: "Focus on personal self-reflection",
    paradoxical: "Include an apparent contradiction that makes sense",
    default: "Challenge assumptions or spark deep reflection"
  }
  
  const styleGuidance = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.default
  
  try {
    const { text } = await generateText({
      model: openai('gpt-5-nano-2025-08-07'),
      temperature: 0.95,
      prompt: `Generate a single ${style} thought-provoking question about ${topic}. 
      
The question should:
- Be unique and not commonly asked
- ${styleGuidance}
- Be between 10-30 words
- Not be a yes/no question unless it's rhetorical
- Feel fresh and unexpected
- Be DIFFERENT from these recently used questions:
${usedQuestionsList ? `- ${usedQuestionsList}` : '(no previous questions)'}

Examples of good questions by style:
Philosophical: "If all your memories were fiction, would your identity still be real?"
Humorous: "Why do we park in driveways but drive on parkways?"
Whimsical: "If colors had personalities, which one would throw the best parties?"
Hypothetical: "What if gravity only worked when you were paying attention to it?"
Introspective: "What lie do you tell yourself most often, and why do you believe it?"
Paradoxical: "Can you truly miss something you never knew existed?"

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
  const currentDay = getCurrentDayTimestampEST()
  const nextDay = getNextDayTimestampEST()
  const currentDayISO = currentDay.toISOString()
  const nextDayISO = nextDay.toISOString()
  
  // Check for existing current question
  const { data: currentQuestion } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('is_current', true)
    .single()
  
  // Check if current question is stale (more than 24 hours old)
  if (currentQuestion && currentQuestion.used_at) {
    const questionDate = new Date(currentQuestion.used_at)
    const timeZone = 'America/New_York'
    const questionEST = toZonedTime(questionDate, timeZone)
    const questionDay = new Date(
      questionEST.getFullYear(),
      questionEST.getMonth(),
      questionEST.getDate(),
      0, 0, 0, 0
    )
    
    const daysDiff = Math.floor((currentDay.getTime() - questionDay.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 0) {
      console.log('[Safeguard] Current question is', daysDiff, 'days old, forcing rotation')
      // Force rotation by marking current as not current
      await supabaseAdmin
        .from('questions')
        .update({ is_current: false })
        .eq('id', currentQuestion.id)
      
      // Try to use next question if available
      const { data: nextQ } = await supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_next', true)
        .single()
      
      if (nextQ) {
        await supabaseAdmin
          .from('questions')
          .update({ 
            is_current: true,
            is_next: false,
            used_at: currentDayISO
          })
          .eq('id', nextQ.id)
      }
      
      return // Re-run ensureQuestionsExist after rotation
    }
  }
  
  // Check for existing next question
  const { data: nextQuestion } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('is_next', true)
    .single()
  
  const usedQuestions = await getUsedQuestions()
  
  // Generate current question if missing
  if (!currentQuestion) {
    console.log('Generating missing current question for today')
    const newCurrentText = await generateNewQuestion(usedQuestions)
    
    await supabaseAdmin
      .from('questions')
      .insert({
        question: newCurrentText,
        used_at: currentDayISO,
        is_current: true,
        is_next: false
      })
  }
  
  // Generate next question if missing
  if (!nextQuestion) {
    console.log('Generating missing next question for tomorrow')
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
  const currentDay = getCurrentDayTimestampEST()
  const currentDayISO = currentDay.toISOString()
  
  console.log('[Rotation] Starting rotation for day:', currentDayISO)
  
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
        used_at: currentDayISO,
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
  const { error: clearError } = await supabaseAdmin
    .from('questions')
    .update({ is_current: false })
    .eq('is_current', true)
  
  if (clearError) {
    console.error('[Rotation] Failed to clear current question:', clearError)
  }
  
  // Update the next question to be current
  const { error: updateError } = await supabaseAdmin
    .from('questions')
    .update({ 
      is_current: true,
      is_next: false,
      used_at: currentDayISO
    })
    .eq('id', nextQuestion.id)
  
  if (updateError) {
    console.error('[Rotation] Failed to update next to current:', updateError)
    throw updateError
  }
  
  console.log('[Rotation] Successfully rotated question:', nextQuestion.question.substring(0, 50) + '...')
  
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
        currentDayTimestamp: getCurrentDayTimestampEST().toISOString(),
        nextDayTimestamp: getNextDayTimestampEST().toISOString()
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
        currentDayTimestamp: getCurrentDayTimestampEST().toISOString(),
        nextDayTimestamp: getNextDayTimestampEST().toISOString()
      })
    }
    
    // Default: get current question for backward compatibility
    const currentDay = getCurrentDayTimestampEST()
    const currentDayISO = currentDay.toISOString()
    
    // Check if current question's day matches actual current day
    const { data: currentQuestion } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('is_current', true)
      .single()
    
    if (currentQuestion) {
      const questionDay = currentQuestion.used_at ? new Date(currentQuestion.used_at) : null
      if (questionDay) {
        // Convert question's used_at to EST for comparison
        const timeZone = 'America/New_York'
        const questionDayEST = toZonedTime(questionDay, timeZone)
        const questionDayMidnight = new Date(
          questionDayEST.getFullYear(), 
          questionDayEST.getMonth(), 
          questionDayEST.getDate(), 
          0, 0, 0, 0
        )
        
        // If question is from current day, return it
        if (questionDayMidnight.getTime() === currentDay.getTime()) {
          return NextResponse.json({
            question: currentQuestion.question,
            source: 'database',
            createdAt: currentQuestion.created_at,
            dayTimestamp: currentDayISO
          })
        }
        
        // Question is outdated, trigger rotation
        console.log('[Check] Current question is outdated')
        console.log('[Check] Question day:', questionDayMidnight.toISOString())
        console.log('[Check] Current day:', currentDay.toISOString())
        const newQuestion = await rotateQuestions()
        return NextResponse.json({
          question: newQuestion,
          source: 'rotated',
          dayTimestamp: currentDayISO
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
      dayTimestamp: currentDayISO
    })
    
  } catch (error) {
    console.error('Error in GET handler:', error)
    return NextResponse.json({ 
      question: 'What questions remain unasked in the spaces between our thoughts?',
      source: 'error-fallback',
      error: error instanceof Error ? error.message : 'Service temporarily unavailable',
      dayTimestamp: getCurrentDayTimestampEST().toISOString()
    })
  }
}

// Keep POST endpoint for compatibility
export async function POST(request: Request) {
  return GET(request)
}