"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"

interface Question {
  text: string
  timestamp: number
}

export default function QuestionSite() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [nextQuestion, setNextQuestion] = useState<Question | null>(null)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isUntyping, setIsUntyping] = useState(false)
  const [timeUntilNext, setTimeUntilNext] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const [showProgressBars, setShowProgressBars] = useState(false)
  const [lastRotationDay, setLastRotationDay] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState("getting today's question")
  const rotationInProgressRef = useRef(false)

  const getCurrentDayTimestampEST = () => {
    // Get current time in Eastern Time (handles EST/EDT automatically)
    const now = new Date()
    const easternTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" })
    const easternTime = new Date(easternTimeStr)
    
    const currentDay = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate(), 0, 0, 0, 0)
    return currentDay.getTime()
  }

  const getTimeUntilNextDayEST = () => {
    // Get current time in Eastern Time (handles EST/EDT automatically)
    const now = new Date()
    const easternTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" })
    const easternTime = new Date(easternTimeStr)
    
    const tomorrow = new Date(easternTime)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    return tomorrow.getTime() - easternTime.getTime()
  }
  
  // Loading messages that change every second
  const loadingMessages = [
    "getting today's question",
    "fetching something curious",
    "loading today's thought",
    "preparing your daily wonder",
    "finding today's curiosity",
    "retrieving today's question"
  ]

  // Initialize questions on mount
  const initializeQuestions = useCallback(async () => {
    try {
      const response = await fetch('/api/generate-question?action=initialize', {
        method: 'GET',
        cache: 'no-cache'
      })

      if (!response.ok) {
        throw new Error('Failed to initialize questions')
      }

      const data = await response.json()
      
      if (data.current) {
        setCurrentQuestion({
          text: data.current.question,
          timestamp: new Date(data.currentDayTimestamp || data.currentHourTimestamp).getTime()
        })
      }
      
      if (data.next) {
        setNextQuestion({
          text: data.next.question,
          timestamp: new Date(data.nextDayTimestamp || data.nextHourTimestamp).getTime()
        })
      }
      
      setLastRotationDay(getCurrentDayTimestampEST())
      setIsLoading(false)
    } catch (error) {
      console.error('Error initializing questions:', error)
      // Retry in 5 seconds
      setTimeout(initializeQuestions, 5000)
    }
  }, [])

  // Rotate questions when day changes
  const rotateQuestions = useCallback(async () => {
    const currentDay = getCurrentDayTimestampEST()
    
    // Prevent duplicate rotations
    if (rotationInProgressRef.current || lastRotationDay === currentDay) {
      return
    }
    
    rotationInProgressRef.current = true
    
    try {
      // First, transition to the pre-loaded next question with untype/retype animation
      if (nextQuestion) {
        // Start untyping animation
        setIsUntyping(true)
        
        // Wait for untyping to complete
        await new Promise(resolve => {
          const text = displayedText
          let index = text.length
          
          const untypeInterval = setInterval(() => {
            if (index > 0) {
              setDisplayedText(text.slice(0, index - 1))
              index--
            } else {
              clearInterval(untypeInterval)
              setIsUntyping(false)
              resolve(undefined)
            }
          }, 30) // Faster untyping
        })
        
        // Switch to next question
        setCurrentQuestion({
          text: nextQuestion.text,
          timestamp: currentDay
        })
        setNextQuestion(null)
      }
      
      // Trigger backend rotation to generate new next question
      const response = await fetch('/api/generate-question?action=rotate', {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        throw new Error('Failed to rotate questions')
      }
      
      // Fetch both questions to get the newly generated next
      const bothResponse = await fetch('/api/generate-question?action=get-both', {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (bothResponse.ok) {
        const data = await bothResponse.json()
        
        if (data.next) {
          setNextQuestion({
            text: data.next.question,
            timestamp: new Date(data.nextHourTimestamp).getTime()
          })
        }
      }
      
      setLastRotationDay(currentDay)
    } catch (error) {
      console.error('Error rotating questions:', error)
      // Try fetching both questions as fallback
      try {
        const response = await fetch('/api/generate-question?action=get-both', {
          method: 'GET',
          cache: 'no-cache'
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.current) {
            setCurrentQuestion({
              text: data.current.question,
              timestamp: new Date(data.currentDayTimestamp || data.currentHourTimestamp).getTime()
            })
          }
          
          if (data.next) {
            setNextQuestion({
              text: data.next.question,
              timestamp: new Date(data.nextDayTimestamp || data.nextHourTimestamp).getTime()
            })
          }
        }
      } catch (fallbackError) {
        console.error('Fallback fetch failed:', fallbackError)
      }
    } finally {
      rotationInProgressRef.current = false
    }
  }, [nextQuestion, displayedText, lastRotationDay])

  // Typing animation effect
  useEffect(() => {
    if (!currentQuestion || isUntyping || isLoading) return

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
  }, [currentQuestion, isUntyping, isLoading])

  // Cursor blink effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 1000) // Blink every second

    return () => clearInterval(blinkInterval)
  }, [])

  // Loading message rotation
  useEffect(() => {
    if (!isLoading) return
    
    let messageIndex = 0
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length
      setLoadingMessage(loadingMessages[messageIndex])
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isLoading])

  // Timer and rotation logic
  useEffect(() => {
    let timer: NodeJS.Timeout

    const updateTimer = () => {
      const timeLeft = getTimeUntilNextDayEST()
      const currentDay = getCurrentDayTimestampEST()

      // Check if we need to rotate (new day started)
      if (lastRotationDay !== null && lastRotationDay !== currentDay) {
        rotateQuestions()
      }

      // Update countdown with hours, minutes, and seconds
      const hours = Math.floor(timeLeft / (60 * 60 * 1000))
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000))
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000)
      
      if (hours > 0) {
        setTimeUntilNext(`${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`)
      } else {
        setTimeUntilNext(`${minutes}:${seconds.toString().padStart(2, "0")}`)
      }

      // Pre-rotation check: ensure we're ready for the next hour
      if (timeLeft <= 5000 && !nextQuestion) {
        // Try to fetch next question if we don't have one
        fetch('/api/generate-question?action=get-both', {
          method: 'GET',
          cache: 'no-cache'
        })
          .then(response => response.json())
          .then(data => {
            if (data.next) {
              setNextQuestion({
                text: data.next.question,
                timestamp: new Date(data.nextDayTimestamp || data.nextHourTimestamp).getTime()
              })
            }
          })
          .catch(error => console.error('Error pre-fetching next question:', error))
      }
    }

    // Initial fetch
    if (!currentQuestion) {
      initializeQuestions()
    }

    // Start the timer
    updateTimer()
    timer = setInterval(updateTimer, 1000)

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [currentQuestion, nextQuestion, lastRotationDay, rotateQuestions, initializeQuestions])

  // Progress bar calculations
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

  // Handle window resize for progress bars
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
            style={{ color: isLoading ? "var(--color-muted-brown)" : "var(--color-charcoal)" }}
          >
            <span className="inline-block">
              {isLoading ? loadingMessage : displayedText}
              {(isTyping || isUntyping || !currentQuestion || isLoading) && (
                <span
                  className={`ml-1 inline-block w-1 h-6 sm:h-8 rounded-full transition-opacity duration-100 ${
                    showCursor ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ backgroundColor: isLoading ? "var(--color-soft-brown)" : "var(--color-dark-brown)" }}
                />
              )}
            </span>
          </div>
        </div>

        {/* Timer */}
        {timeUntilNext && !isLoading && (
          <div className="space-y-2">
            <div className="text-sm font-light tracking-wide" style={{ color: "var(--color-muted-brown)" }}>
              next question in
            </div>
            <div className="text-lg font-mono" style={{ color: "var(--color-dark-brown)" }}>
              {timeUntilNext}
            </div>
          </div>
        )}

        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400">
            {nextQuestion ? '✓ Next question ready' : '⏳ Preparing next question...'}
          </div>
        )}

        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          <Link
            href="/about"
            className="text-xs underline hover:no-underline transition-all duration-200"
            style={{ color: "var(--color-muted-brown)" }}
          >
            what is this
          </Link>
          <span className="text-xs" style={{ color: "var(--color-muted-brown)" }}>·</span>
          <Link
            href="/past-questions"
            className="text-xs underline hover:no-underline transition-all duration-200"
            style={{ color: "var(--color-muted-brown)" }}
          >
            past questions
          </Link>
          <span className="text-xs" style={{ color: "var(--color-muted-brown)" }}>·</span>
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