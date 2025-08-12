import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

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

// In-memory cache for questions
// This ensures the same question is served to all users for the same hour
const questionCache = new Map<number, { question: string; generatedAt: number }>()

function getCurrentHourTimestamp(): number {
  const now = new Date()
  const currentHour = new Date(now)
  currentHour.setMinutes(0, 0, 0)
  return currentHour.getTime()
}

function getHourSeed(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60))
}

function getFallbackQuestion(hourSeed: number): string {
  const index = hourSeed % fallbackQuestions.length
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

async function generateNewQuestion(hourSeed: number): Promise<string> {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    return getFallbackQuestion(hourSeed)
  }

  const styleIndex = hourSeed % questionStyles.length
  const topicIndex = (hourSeed * 7) % questionTopics.length
  const style = questionStyles[styleIndex]
  const topic = questionTopics[topicIndex]

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0.9,
      maxTokens: 100,
      seed: hourSeed, // Use hour seed for more deterministic results
      prompt: `Generate a single ${style} thought-provoking question about ${topic}. 
      
The question should:
- Be unique and not commonly asked
- Challenge assumptions or spark deep reflection
- Be between 10-30 words
- Not be a yes/no question
- Feel fresh and unexpected

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

    return question
  } catch (error) {
    console.error('AI generation failed:', error)
    return getFallbackQuestion(hourSeed)
  }
}

export async function GET() {
  const currentHourTimestamp = getCurrentHourTimestamp()
  const hourSeed = getHourSeed()
  
  // Check if we have a cached question for this hour
  const cached = questionCache.get(currentHourTimestamp)
  
  if (cached) {
    console.log('Serving cached question for hour:', new Date(currentHourTimestamp).toISOString())
    return NextResponse.json({ 
      question: cached.question,
      source: 'cache',
      hourTimestamp: currentHourTimestamp
    })
  }

  // Generate new question for this hour
  console.log('Generating new question for hour:', new Date(currentHourTimestamp).toISOString())
  const question = await generateNewQuestion(hourSeed)
  
  // Cache the question
  questionCache.set(currentHourTimestamp, {
    question,
    generatedAt: Date.now()
  })
  
  // Clean up old cache entries (keep only last 24 hours)
  const twentyFourHoursAgo = currentHourTimestamp - (24 * 60 * 60 * 1000)
  for (const [timestamp] of questionCache) {
    if (timestamp < twentyFourHoursAgo) {
      questionCache.delete(timestamp)
    }
  }
  
  return NextResponse.json({ 
    question,
    source: process.env.OPENAI_API_KEY ? 'ai' : 'fallback',
    hourTimestamp: currentHourTimestamp
  })
}

// Remove POST endpoint - we'll only use GET now
export async function POST() {
  // Redirect POST requests to GET
  return GET()
}