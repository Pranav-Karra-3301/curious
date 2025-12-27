# Curious - Production-Ready Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to transform Curious from a client-dependent application into a robust, production-ready system that generates and rotates questions reliably regardless of user traffic or database state.

---

## Current Issues Identified

### 1. **Client-Driven Architecture (Critical)**
- **Problem**: All question rotation and generation depends on website visits
- **Impact**: If no one visits at midnight EST, rotation never happens
- **Location**: `app/api/generate-question/route.ts:367-509`

### 2. **Supabase Free Tier Pausing (Critical)**
- **Problem**: Supabase pauses after 7 days of inactivity on free tier
- **Impact**: Entire application breaks when database is paused
- **Workaround Needed**: Keepalive mechanism or alternative storage

### 3. **Race Conditions (Moderate)**
- **Problem**: In-memory lock (`generationInProgress`) only works per serverless instance
- **Impact**: Multiple concurrent requests could duplicate questions
- **Location**: `app/api/generate-question/route.ts:173`

### 4. **Randomization Limitations (Minor)**
- **Problem**: Simple `Math.random()` with 300 style/topic combinations
- **Impact**: Predictable patterns over time, no seasonal awareness
- **Location**: `app/api/generate-question/route.ts:105-108`

### 5. **No CI/CD or Automation (Critical)**
- **Problem**: No GitHub Actions/Workflows exist
- **Impact**: No automated testing, deployment, or scheduled tasks

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (Scheduler)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Daily Rotation  │  │ Question Buffer │  │ Database Warmup │  │
│  │ (Midnight EST)  │  │   (Every 6h)    │  │   (Every 4h)    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    API Endpoints                            ││
│  │  /api/cron/rotate     (rotation via GitHub Action)          ││
│  │  /api/cron/generate   (buffer generation)                   ││
│  │  /api/cron/warmup     (keepalive ping)                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
├─────────────────────────────────────────────────────────────────┤
│  questions table                                                 │
│  ├── id, question, created_at, used_at                          │
│  ├── is_current, is_next                                        │
│  ├── scheduled_for (NEW: date this question is scheduled)       │
│  └── buffer_position (NEW: position in future queue)            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                            │
├─────────────────────────────────────────────────────────────────┤
│  • Displays current question (read-only from DB)                 │
│  • Countdown timer (client-side calculation)                     │
│  • NO rotation logic - just fetches what's current               │
│  • Fallback questions if DB unavailable                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Solution 1: GitHub Actions (Recommended)

### Why GitHub Actions vs Vercel Cron?

| Feature | GitHub Actions | Vercel Cron |
|---------|---------------|-------------|
| Free tier limits | 2,000 mins/month | 1 cron job (Hobby) |
| Reliability | Very high | High |
| Complexity | Medium | Low |
| Flexibility | Full control | Limited to HTTP calls |
| Secrets management | Built-in | Environment vars |
| Debugging | Full logs | Limited |

**Recommendation**: GitHub Actions for free tier users (more generous limits)

### Workflow 1: Daily Question Rotation

```yaml
# .github/workflows/daily-rotation.yml
name: Daily Question Rotation

on:
  schedule:
    # Run at 5:00 AM UTC = Midnight EST (accounting for DST variations)
    - cron: '0 5 * * *'
  workflow_dispatch: # Allow manual trigger

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

jobs:
  rotate-question:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run rotation script
        run: node scripts/rotate-question.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Verify rotation
        run: node scripts/verify-rotation.js
```

### Workflow 2: Question Buffer Generation

```yaml
# .github/workflows/generate-buffer.yml
name: Generate Question Buffer

on:
  schedule:
    # Run every 6 hours to maintain buffer
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  generate-buffer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate buffer questions
        run: node scripts/generate-buffer.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          BUFFER_SIZE: 7  # Keep 7 days of questions ready
```

### Workflow 3: Database Keepalive

```yaml
# .github/workflows/keepalive.yml
name: Database Keepalive

on:
  schedule:
    # Run every 4 hours to prevent Supabase pause
    - cron: '0 */4 * * *'

jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -X GET "${{ secrets.SUPABASE_URL }}/rest/v1/questions?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
          echo "Database pinged successfully"
```

---

## Solution 2: Enhanced Database Schema

### Current Schema Issues
- Only tracks `is_current` and `is_next` (2 questions max)
- No pre-scheduling capability
- No queue management

### Proposed Schema Enhancement

```sql
-- Enhanced questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS scheduled_for DATE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS buffer_position INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS generation_seed TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic TEXT;

-- Index for efficient buffer queries
CREATE INDEX IF NOT EXISTS idx_questions_scheduled_for
  ON questions(scheduled_for) WHERE scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_buffer
  ON questions(buffer_position) WHERE buffer_position IS NOT NULL;

-- View for today's question (timezone-aware)
CREATE OR REPLACE VIEW current_question AS
SELECT * FROM questions
WHERE scheduled_for = (CURRENT_DATE AT TIME ZONE 'America/New_York')::DATE
LIMIT 1;

-- View for upcoming questions
CREATE OR REPLACE VIEW upcoming_questions AS
SELECT * FROM questions
WHERE scheduled_for > (CURRENT_DATE AT TIME ZONE 'America/New_York')::DATE
ORDER BY scheduled_for ASC;
```

---

## Solution 3: Improved Randomization

### Current Approach (Limited)
```javascript
const styleIndex = Math.floor(Math.random() * questionStyles.length)
const topicIndex = Math.floor(Math.random() * questionTopics.length)
```

### Enhanced Randomization Strategy

```javascript
// scripts/lib/randomization.js

/**
 * Enhanced randomization with multiple entropy sources
 */

// 1. Day-based seed for reproducibility
function getDaySeed(date) {
  const dateString = date.toISOString().split('T')[0];
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// 2. Seasonal themes
const seasonalThemes = {
  winter: ['introspection', 'warmth', 'endings', 'rest', 'reflection'],
  spring: ['growth', 'renewal', 'beginnings', 'hope', 'change'],
  summer: ['adventure', 'freedom', 'energy', 'exploration', 'joy'],
  fall: ['harvest', 'preparation', 'gratitude', 'transition', 'wisdom']
};

function getSeason(date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

// 3. Day-of-week variations
const dayThemes = {
  0: 'reflective',    // Sunday - rest and reflect
  1: 'motivational',  // Monday - start strong
  2: 'practical',     // Tuesday - get things done
  3: 'creative',      // Wednesday - mid-week creativity
  4: 'philosophical', // Thursday - deep thoughts
  5: 'whimsical',     // Friday - lighten up
  6: 'exploratory'    // Saturday - adventure
};

// 4. Avoid recent patterns
function avoidRecentPatterns(recentQuestions, candidates) {
  const recentStyles = new Set(recentQuestions.map(q => q.style));
  const recentTopics = new Set(recentQuestions.map(q => q.topic));

  return candidates.filter(c =>
    !recentStyles.has(c.style) && !recentTopics.has(c.topic)
  );
}

// 5. Weighted random selection
function weightedRandom(items, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// 6. External entropy (optional)
async function getExternalEntropy() {
  try {
    // Use random.org or similar for true randomness
    const response = await fetch('https://www.random.org/integers/?num=1&min=0&max=1000000&col=1&base=10&format=plain');
    return parseInt(await response.text());
  } catch {
    return Date.now();
  }
}

module.exports = {
  getDaySeed,
  getSeason,
  seasonalThemes,
  dayThemes,
  avoidRecentPatterns,
  weightedRandom,
  getExternalEntropy
};
```

### Enhanced Question Generation Prompt

```javascript
// Improved prompt with contextual awareness
function buildEnhancedPrompt({ style, topic, season, dayOfWeek, recentQuestions }) {
  const seasonalContext = seasonalThemes[season];
  const dayMood = dayThemes[dayOfWeek];

  return `Generate a single thought-provoking question.

CONTEXT:
- Style: ${style}
- Topic: ${topic}
- Season: ${season} (themes: ${seasonalContext.join(', ')})
- Day mood: ${dayMood}

REQUIREMENTS:
- Be genuinely unique and surprising
- Avoid clichés and overused philosophical tropes
- The question should feel timely for the ${season} season
- Match the ${dayMood} mood of the day
- Between 10-30 words
- Not a yes/no question

AVOID these recent questions:
${recentQuestions.slice(-10).map(q => `- ${q}`).join('\n')}

STYLE GUIDANCE:
${getStyleGuidance(style)}

Return ONLY the question text.`;
}
```

---

## Solution 4: Timezone-Agnostic Design

### Problem
Current implementation has timezone edge cases and relies on client-side detection.

### Solution: Server-Authoritative Timestamps

```javascript
// All times stored as UTC in database
// All scheduling done by scheduled_for DATE column
// No client-side rotation logic

// scripts/lib/timezone.js
const { format, utcToZonedTime } = require('date-fns-tz');

const TIMEZONE = 'America/New_York';

function getCurrentESTDate() {
  const now = new Date();
  const estTime = utcToZonedTime(now, TIMEZONE);
  return format(estTime, 'yyyy-MM-dd');
}

function getESTDateForScheduling(daysFromNow = 0) {
  const now = new Date();
  const estTime = utcToZonedTime(now, TIMEZONE);
  estTime.setDate(estTime.getDate() + daysFromNow);
  return format(estTime, 'yyyy-MM-dd');
}

// Rotation happens via GitHub Action at fixed UTC time (5 AM UTC = midnight EST)
// No client-side rotation detection needed
```

### Simplified Frontend

```javascript
// app/page.tsx - No rotation logic, just fetch and display
async function fetchTodaysQuestion() {
  const response = await fetch('/api/question');
  const data = await response.json();
  return data.question;
}

// Countdown to next day is purely cosmetic
// Actual rotation is handled by GitHub Action
```

---

## Solution 5: Fallback Strategy (No Supabase)

For when Supabase is paused or unavailable:

### Option A: JSON File in Repository

```javascript
// public/fallback-questions.json
// Updated periodically by GitHub Action
{
  "questions": [
    { "date": "2025-12-27", "question": "..." },
    { "date": "2025-12-28", "question": "..." },
    // ... 30 days of pre-generated questions
  ],
  "generated_at": "2025-12-27T00:00:00Z"
}
```

### Option B: Cloudflare KV (Free Tier)

```javascript
// Workers KV has generous free tier
// 100,000 reads/day, 1,000 writes/day
// Could store questions there as backup
```

### Option C: GitHub Gist as Storage

```javascript
// Store questions in a private gist
// Update via GitHub API in Actions
// Read via raw URL in application
```

---

## Implementation Phases

### Phase 1: GitHub Actions Setup (Day 1)
1. Create `.github/workflows/` directory
2. Implement `keepalive.yml` workflow
3. Implement `daily-rotation.yml` workflow
4. Add required secrets to GitHub repository
5. Test manual workflow dispatch

### Phase 2: Script Development (Day 2)
1. Create `scripts/rotate-question.js`
2. Create `scripts/generate-buffer.js`
3. Create `scripts/verify-rotation.js`
4. Test scripts locally with environment variables

### Phase 3: Database Schema Update (Day 3)
1. Add `scheduled_for` column
2. Add `buffer_position` column
3. Create views for current/upcoming questions
4. Migrate existing data

### Phase 4: Frontend Simplification (Day 4)
1. Remove client-side rotation logic
2. Simplify to read-only fetch
3. Keep countdown as cosmetic feature
4. Add robust fallback handling

### Phase 5: Randomization Enhancement (Day 5)
1. Implement enhanced randomization module
2. Update question generation prompts
3. Add seasonal/day-of-week awareness
4. Test variety over simulated time period

### Phase 6: Monitoring & Alerts (Day 6)
1. Add GitHub Action for health checks
2. Set up failure notifications
3. Create status dashboard updates
4. Document runbook for failures

---

## Scripts to Create

### 1. `scripts/rotate-question.js`

```javascript
#!/usr/bin/env node

/**
 * Daily Question Rotation Script
 * Run by GitHub Action at midnight EST
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function rotateQuestion() {
  const today = getTodayEST();

  console.log(`[Rotation] Starting for ${today}`);

  // 1. Check if today's question already exists
  const { data: existing } = await supabase
    .from('questions')
    .select('*')
    .eq('scheduled_for', today)
    .single();

  if (existing) {
    console.log(`[Rotation] Question already exists for ${today}`);

    // Update flags
    await supabase
      .from('questions')
      .update({ is_current: false })
      .neq('id', existing.id);

    await supabase
      .from('questions')
      .update({ is_current: true, used_at: new Date().toISOString() })
      .eq('id', existing.id);

    return existing;
  }

  // 2. Get from buffer or generate new
  const { data: buffered } = await supabase
    .from('questions')
    .select('*')
    .is('scheduled_for', null)
    .order('buffer_position', { ascending: true })
    .limit(1)
    .single();

  if (buffered) {
    // Use buffered question
    await supabase
      .from('questions')
      .update({ is_current: false })
      .eq('is_current', true);

    await supabase
      .from('questions')
      .update({
        scheduled_for: today,
        is_current: true,
        is_next: false,
        used_at: new Date().toISOString(),
        buffer_position: null
      })
      .eq('id', buffered.id);

    console.log(`[Rotation] Used buffered question: ${buffered.question.substring(0, 50)}...`);
    return buffered;
  }

  // 3. Emergency: Generate on the fly
  console.log('[Rotation] No buffered question, generating emergency question');
  const question = await generateQuestion();

  await supabase
    .from('questions')
    .update({ is_current: false })
    .eq('is_current', true);

  const { data: newQuestion } = await supabase
    .from('questions')
    .insert({
      question: question.text,
      scheduled_for: today,
      is_current: true,
      used_at: new Date().toISOString(),
      style: question.style,
      topic: question.topic
    })
    .select()
    .single();

  console.log(`[Rotation] Created emergency question: ${question.text.substring(0, 50)}...`);
  return newQuestion;
}

// Helper functions would go here...

rotateQuestion()
  .then(() => {
    console.log('[Rotation] Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Rotation] Failed:', error);
    process.exit(1);
  });
```

### 2. `scripts/generate-buffer.js`

```javascript
#!/usr/bin/env node

/**
 * Buffer Generation Script
 * Maintains a 7-day buffer of pre-generated questions
 */

const BUFFER_SIZE = parseInt(process.env.BUFFER_SIZE || '7');

async function generateBuffer() {
  // Count existing buffer
  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .is('scheduled_for', null)
    .not('buffer_position', 'is', null);

  const needed = BUFFER_SIZE - (count || 0);

  if (needed <= 0) {
    console.log(`[Buffer] Buffer full (${count}/${BUFFER_SIZE})`);
    return;
  }

  console.log(`[Buffer] Generating ${needed} questions...`);

  // Get used questions for duplicate prevention
  const { data: used } = await supabase
    .from('questions')
    .select('question')
    .not('used_at', 'is', null);

  const usedQuestions = used?.map(q => q.question) || [];

  // Get current max buffer position
  const { data: maxPos } = await supabase
    .from('questions')
    .select('buffer_position')
    .order('buffer_position', { ascending: false })
    .limit(1)
    .single();

  let nextPosition = (maxPos?.buffer_position || 0) + 1;

  for (let i = 0; i < needed; i++) {
    const question = await generateQuestion(usedQuestions);

    await supabase
      .from('questions')
      .insert({
        question: question.text,
        buffer_position: nextPosition++,
        style: question.style,
        topic: question.topic,
        generation_seed: question.seed
      });

    usedQuestions.push(question.text);
    console.log(`[Buffer] Generated ${i + 1}/${needed}`);
  }

  console.log(`[Buffer] Complete`);
}
```

---

## GitHub Secrets Required

Add these to your repository settings (Settings → Secrets and variables → Actions):

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (elevated privileges) |
| `SUPABASE_ANON_KEY` | Anonymous key (for keepalive) |
| `OPENAI_API_KEY` | OpenAI API key for generation |

---

## Monitoring & Alerts

### GitHub Action Status Badge

```markdown
![Daily Rotation](https://github.com/USERNAME/curious/actions/workflows/daily-rotation.yml/badge.svg)
![Buffer Status](https://github.com/USERNAME/curious/actions/workflows/generate-buffer.yml/badge.svg)
![Database Health](https://github.com/USERNAME/curious/actions/workflows/keepalive.yml/badge.svg)
```

### Failure Notifications

```yaml
# In each workflow, add:
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: `⚠️ ${context.workflow} failed`,
        body: `Workflow failed at ${new Date().toISOString()}\n\nRun: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
      });
```

---

## Cost Analysis

### GitHub Actions (Free Tier)
- 2,000 minutes/month for private repos
- Unlimited for public repos
- Our usage: ~15 min/day = ~450 min/month ✓

### Supabase (Free Tier)
- 500MB database
- 2GB bandwidth
- Pauses after 7 days inactivity
- Our solution: Keepalive prevents pause ✓

### OpenAI
- ~8 questions/day (buffer + daily)
- ~$0.01/day with GPT-4 nano
- ~$3/year ✓

---

## Summary

| Issue | Solution | Effort |
|-------|----------|--------|
| Client-driven rotation | GitHub Actions scheduler | Medium |
| Supabase pausing | Keepalive workflow | Low |
| Race conditions | Server-side only rotation | Medium |
| Limited randomization | Enhanced entropy module | Medium |
| No automation | Full CI/CD pipeline | Medium |
| Timezone issues | UTC storage + EST scheduling | Low |

**Total estimated effort**: 3-5 days for full implementation

**Immediate quick wins**:
1. Add keepalive workflow (prevents Supabase pause)
2. Add daily rotation workflow (removes client dependency)
3. Simplify frontend to read-only

---

## Next Steps

1. Review and approve this plan
2. Create GitHub Secrets in repository
3. Implement Phase 1 (GitHub Actions)
4. Test with manual workflow dispatch
5. Monitor for 1 week before proceeding to Phase 2
