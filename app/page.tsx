"use client"

import { useState, useEffect } from "react"

interface Question {
  text: string
  timestamp: number
}

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
]

export default function QuestionSite() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [timeUntilNext, setTimeUntilNext] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set())
  const [showProgressBars, setShowProgressBars] = useState(false)

  const getCurrentQuestionIndex = () => {
    const now = new Date()
    const hoursSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60))
    return hoursSinceEpoch % fallbackQuestions.length
  }

  const getTimeUntilNextHour = () => {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    return nextHour.getTime() - now.getTime()
  }

  const getCurrentHourTimestamp = () => {
    const now = new Date()
    const currentHour = new Date(now)
    currentHour.setMinutes(0, 0, 0)
    return currentHour.getTime()
  }

  const generateQuestion = async (): Promise<string> => {
    try {
      const response = await fetch('/api/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usedQuestions: Array.from(usedQuestions).slice(-10)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate question')
      }

      const data = await response.json()
      
      if (data.source === 'fallback') {
        console.log('Using fallback question')
      }
      
      return data.question
    } catch (error) {
      console.error('Error generating question:', error)
      const questionIndex = getCurrentQuestionIndex()
      return fallbackQuestions[questionIndex]
    }
  }

  // Typing animation effect
  useEffect(() => {
    if (!currentQuestion) return

    setIsTyping(true)
    setDisplayedText("")

    const text = currentQuestion.text
    let index = 0

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        setIsTyping(false)
        clearInterval(typeInterval)
      }
    }, 50) // 50ms per character for smooth typing

    return () => clearInterval(typeInterval)
  }, [currentQuestion])

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 1000) // Blink every second, synced with countdown

    return () => clearInterval(blinkInterval)
  }, [])

  // Timer countdown effect
  useEffect(() => {
    const updateTimer = () => {
      if (!currentQuestion) return

      const timeLeft = getTimeUntilNextHour()

      if (timeLeft <= 1000) {
        // Within 1 second of next hour
        // Time to generate new question
        generateQuestion().then((newQuestionText) => {
          setUsedQuestions((prev) => {
            const newSet = new Set(prev)
            newSet.add(newQuestionText)
            // Keep only last 100 questions to prevent memory issues
            if (newSet.size > 100) {
              const arr = Array.from(newSet)
              return new Set(arr.slice(-50))
            }
            return newSet
          })

          setCurrentQuestion({
            text: newQuestionText,
            timestamp: getCurrentHourTimestamp(),
          })
        })
      } else {
        const minutes = Math.floor(timeLeft / (60 * 1000))
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000)
        setTimeUntilNext(`${minutes}:${seconds.toString().padStart(2, "0")}`)
      }
    }

    const timer = setInterval(updateTimer, 1000)
    updateTimer() // Run immediately

    return () => clearInterval(timer)
  }, [currentQuestion, usedQuestions])

  // Initialize with first question
  useEffect(() => {
    generateQuestion().then((questionText) => {
      setUsedQuestions((prev) => new Set(prev).add(questionText))

      setCurrentQuestion({
        text: questionText,
        timestamp: getCurrentHourTimestamp(),
      })
    })
  }, [])

  const getYearProgress = () => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1)
    const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    const daysPassed = (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    return Math.floor((daysPassed / totalDays) * 100)
  }

  const getMonthProgress = () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const totalDays = (endOfMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)
    const daysPassed = (now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)
    return Math.floor((daysPassed / totalDays) * 100)
  }

  useEffect(() => {
    const checkHeight = () => {
      setShowProgressBars(window.innerHeight >= 600 && window.innerWidth >= 768)
    }

    checkHeight()
    window.addEventListener("resize", checkHeight)
    return () => window.removeEventListener("resize", checkHeight)
  }, [])

  const yearProgress = getYearProgress()
  const monthProgress = getMonthProgress()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().toLocaleString("default", { month: "long" })

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 md:p-6 relative"
      style={{ backgroundColor: "var(--color-cream)" }}
    >
      {showProgressBars && (
        <div className="fixed left-4 top-1/2 transform -translate-y-1/2 hidden md:block">
          <div className="flex flex-col space-y-1">
            {Array.from({ length: 20 }, (_, i) => {
              const segmentProgress = (yearProgress / 100) * 20
              const isFilled = i < Math.floor(segmentProgress)
              return (
                <div key={i} className="relative group">
                  <div className="absolute inset-0 w-8 h-6 -translate-x-3 -translate-y-1 cursor-pointer" />
                  <div
                    className="w-1 h-3 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: isFilled ? "var(--color-dark-brown)" : "var(--color-muted-brown)",
                      opacity: isFilled ? 1 : 0.3,
                    }}
                  />
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    {isFilled ? `${yearProgress}% of year completed` : `${100 - yearProgress}% of year remaining`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showProgressBars && (
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
          <div className="flex flex-col space-y-1">
            {Array.from({ length: 20 }, (_, i) => {
              const segmentProgress = (monthProgress / 100) * 20
              const isFilled = i < Math.floor(segmentProgress)
              return (
                <div key={i} className="relative group">
                  <div className="absolute inset-0 w-8 h-6 translate-x-3 -translate-y-1 cursor-pointer" />
                  <div
                    className="w-1 h-3 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: isFilled ? "var(--color-dark-brown)" : "var(--color-muted-brown)",
                      opacity: isFilled ? 1 : 0.3,
                    }}
                  />
                  <div className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    {isFilled ? `${monthProgress}% of month completed` : `${100 - monthProgress}% of month remaining`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-2xl w-full text-center space-y-6 md:space-y-8 fade-in">
        {/* Main question with typing animation */}
        <div className="space-y-4">
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed min-h-[3rem] sm:min-h-[4rem] flex items-center justify-center px-2"
            style={{ color: "var(--color-charcoal)" }}
          >
            <span className="inline-block">
              {displayedText}
              <span
                className={`ml-1 inline-block w-1 h-6 sm:h-8 rounded-full transition-opacity duration-100 ${
                  showCursor ? "opacity-100" : "opacity-0"
                }`}
                style={{ backgroundColor: "var(--color-dark-brown)" }}
              />
            </span>
          </div>
        </div>

        {/* Timer */}
        {timeUntilNext && (
          <div className="space-y-2">
            <div className="text-sm font-light tracking-wide" style={{ color: "var(--color-muted-brown)" }}>
              next question in
            </div>
            <div className="text-lg font-mono" style={{ color: "var(--color-dark-brown)" }}>
              {timeUntilNext}
            </div>
          </div>
        )}

        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
          <a
            href="https://pranavkarra.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline hover:no-underline transition-all duration-200"
            style={{ color: "var(--color-muted-brown)" }}
          >
            pranavkarra.me
          </a>
        </div>
      </div>
    </div>
  )
}