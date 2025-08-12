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

function getRandomFallback(hourSeed: number): string {
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

export async function POST(request: Request) {
  try {
    const { usedQuestions = [] } = await request.json()
    
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60))
      return NextResponse.json({ 
        question: getRandomFallback(hourSeed),
        source: 'fallback'
      })
    }

    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60))
    const styleIndex = hourSeed % questionStyles.length
    const topicIndex = (hourSeed * 7) % questionTopics.length
    const style = questionStyles[styleIndex]
    const topic = questionTopics[topicIndex]

    try {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        temperature: 0.9,
        maxTokens: 100,
        prompt: `Generate a single ${style} thought-provoking question about ${topic}. 
        
The question should:
- Be unique and not commonly asked
- Challenge assumptions or spark deep reflection
- Be between 10-30 words
- Not be a yes/no question
- Feel fresh and unexpected

${usedQuestions.length > 0 ? `Avoid questions similar to these recent ones: ${usedQuestions.slice(-3).join(', ')}` : ''}

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

      return NextResponse.json({ 
        question,
        source: 'ai'
      })
    } catch (aiError) {
      console.error('AI generation failed:', aiError)
      return NextResponse.json({ 
        question: getRandomFallback(hourSeed),
        source: 'fallback'
      })
    }
  } catch (error) {
    console.error('Error in generate-question route:', error)
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60))
    return NextResponse.json({ 
      question: getRandomFallback(hourSeed),
      source: 'fallback'
    })
  }
}