<p align="center">
  <img src="public/logo.png" alt="curious?" width="200"/>
</p>

# Curious

A thought-provoking question site that presents a new philosophical question every hour. The site uses a smooth typing animation to reveal questions and includes visual progress bars showing the passage of time through the year and month.

## Features

- **Hourly Questions**: Automatically generates and displays a new thought-provoking question every hour
- **Two-Question Buffer System**: Pre-generates the next question to ensure seamless transitions with no loading delays
- **Smooth Animations**: Questions are revealed with a typing effect and transition with untype/retype animations
- **Visual Time Progress**: Interactive progress bars showing year and month completion percentages
- **AI-Powered Generation**: Uses OpenAI GPT-5 to generate unique, philosophical questions
- **Database Persistence**: Questions are stored in Supabase to prevent duplicates and track history

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-5 API
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Contributors

- **Pranav Karra** - Original creator - [pranavkarra.me](https://pranavkarra.me)
- **Claude (Anthropic)** - Implemented two-question buffer system for seamless hourly transitions