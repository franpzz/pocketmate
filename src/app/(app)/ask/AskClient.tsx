'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { monthlyIncome, totalOut, leftover, ytd, currentMonth, cycleLabel } from '@/lib/finance'
import s from './ask.module.css'

interface Message { role: 'user' | 'ai'; text: string; html: string }

const QUICK_PROMPTS = [
  'How am I tracking this month?',
  'Where am I overspending?',
  'When will I hit my savings goal?',
  'How can I save more?',
]

// Convert **bold** to <strong>
function md(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export default function AskClient() {
  const { profile, fixedExpenses, monthlySavings, cycleState, transactions, loading } = useAppState()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Set intro message once data loads
  useEffect(() => {
    if (!profile || !cycleState) return
    if (messages.length > 0) return          // don't overwrite on refetch

    const cm = currentMonth()
    const months = monthlySavings?.months ?? new Array(12).fill(0)
    const locked = months[cm] ?? 0
    let introText: string
    if (cycleState.has_first_pay) {
      introText = `Hey ${profile.name}! Your wallet is **$${Math.abs(cycleState.wallet).toLocaleString()}**${cycleState.wallet < 0 ? ' overdrawn' : ''}. You've locked in **$${locked.toLocaleString()}** in savings this month. What would you like to know?`
    } else {
      introText = `Hey ${profile.name}! Tap **"I got paid"** on the dashboard to start your first cycle. Your pay is $${profile.income.toLocaleString()} per ${cycleLabel(profile.cadence)}. What would you like to know?`
    }
    setMessages([{ role: 'ai', text: introText, html: md(introText) }])
  }, [profile, cycleState, monthlySavings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function buildSystemPrompt(): string {
    if (!profile) return ''
    const cm = currentMonth()
    const months = monthlySavings?.months ?? new Array(12).fill(0)
    const locked = months[cm] ?? 0
    const incM  = monthlyIncome(profile.income, profile.cadence, profile.extra)
    const outM  = Math.round(totalOut(fixedExpenses, profile.groceries, profile.dining, profile.transport, profile.entertainment))
    const left  = Math.round(leftover(profile.income, profile.cadence, profile.extra, fixedExpenses, profile.groceries, profile.dining, profile.transport, profile.entertainment))
    const ytdAmt = ytd(months)
    const fixedList = fixedExpenses.length
      ? fixedExpenses.map(f => `  - ${f.name}: $${f.amount}${f.split > 1 ? ` (split ${f.split}x)` : ''}`).join('\n')
      : '  - None'

    // Category spending summary (expenses only)
    const catTotals: Record<string, { total: number; count: number }> = {}
    for (const t of transactions) {
      if (t.is_positive) continue
      if (!catTotals[t.cat]) catTotals[t.cat] = { total: 0, count: 0 }
      catTotals[t.cat].total += t.amount
      catTotals[t.cat].count += 1
    }
    const catSummary = Object.entries(catTotals)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, { total, count }]) => `  - ${cat}: $${total.toFixed(2)} (${count} transaction${count !== 1 ? 's' : ''})`)
      .join('\n') || '  - No expense transactions yet'

    // Transaction list (most recent first, up to 200)
    const txnLines = transactions
      .slice(0, 200)
      .map(t => `  ${t.date} | ${t.name} | ${t.cat} | ${t.is_positive ? '+' : '-'}$${t.amount.toFixed(2)}`)
      .join('\n') || '  No transactions recorded yet'

    return `You are PocketMate, a friendly and concise personal finance assistant. Answer using the user's real data below.

USER FINANCIAL DATA:
- Name: ${profile.name}
- Pay: $${profile.income.toLocaleString()} per ${cycleLabel(profile.cadence)} (monthly equivalent: $${incM.toLocaleString()})
- Monthly outgoings: $${outM.toLocaleString()}
- Cycle leftover after expenses: $${left.toLocaleString()} per ${cycleLabel(profile.cadence)}
- Monthly savings target: $${profile.monthly_target.toLocaleString()}
- This month locked savings: $${locked.toLocaleString()}
- Year-to-date savings: $${ytdAmt.toLocaleString()}
- Current wallet balance: $${(cycleState?.wallet ?? 0).toLocaleString()}
- Weekly budgets — groceries: $${profile.groceries}, dining: $${profile.dining}, transport: $${profile.transport}, entertainment: $${profile.entertainment}
- Fixed expenses:\n${fixedList}

SPENDING BY CATEGORY (expenses only, all time):
${catSummary}

TRANSACTION HISTORY (most recent first):
${txnLines}

RULES:
- Be helpful, warm, and concise (under 150 words unless detail is requested).
- Use **bold** for key figures.
- Give actionable advice grounded in the user's actual numbers.
- Never make up data not provided above.`
  }

  async function send(msg: string) {
    msg = msg.trim()
    if (!msg || thinking) return

    const userMsg: Message = { role: 'user', text: msg, html: msg }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setThinking(true)

    try {
      // Gemini requires conversation to start with 'user' role — skip leading AI intro
      const allMessages = [...messages, userMsg]
      const startIdx = allMessages.findIndex(m => m.role === 'user')
      const history = (startIdx >= 0 ? allMessages.slice(startIdx) : allMessages)
        .map(m => ({ role: m.role, text: m.text }))

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: buildSystemPrompt(), messages: history }),
      })

      const data = await res.json()
      let respText: string
      if (res.ok) {
        respText = data.text || 'Sorry, I got an empty response.'
      } else if (res.status === 503) {
        respText = 'AI is not configured yet. Add a **GROQ_API_KEY** in your Vercel environment variables.'
      } else if (data.status === 429) {
        respText = 'Rate limit reached — please wait a moment and try again.'
      } else {
        console.error('AI error:', data)
        respText = 'Sorry, I couldn\'t reach the AI right now. Please try again.'
      }

      setMessages(prev => [...prev, { role: 'ai', text: respText, html: md(respText) }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Connection error. Please try again.',
        html: 'Connection error. Please try again.',
      }])
    } finally {
      setThinking(false)
    }
  }

  if (loading) return null

  const initials = profile?.name.charAt(0).toUpperCase() ?? '?'

  return (
    <div>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Ask PocketMate</h1>
        <p className={s.pageSub}>Your personal finance assistant</p>
      </div>

      <div className={s.chatWrap}>
        {/* Quick prompts */}
        <div className={s.quickPrompts}>
          {QUICK_PROMPTS.map(q => (
            <button key={q} className={s.qp} onClick={() => send(q)}>{q}</button>
          ))}
        </div>

        {/* Messages */}
        <div className={s.messages}>
          {messages.map((m, i) => (
            <div key={i} className={`${s.msg} ${m.role === 'user' ? s.user : ''}`}>
              <div className={s.msgAvatar}>{m.role === 'user' ? initials : '✦'}</div>
              {m.role === 'ai'
                ? <div className={s.bubble} dangerouslySetInnerHTML={{ __html: m.html }} />
                : <div className={s.bubble}>{m.html}</div>
              }
            </div>
          ))}
          {thinking && (
            <div className={s.msg}>
              <div className={s.msgAvatar}>✦</div>
              <div className={s.bubble} style={{ color: 'var(--text3)' }}>…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className={s.inputRow}>
          <input
            ref={inputRef}
            className={s.chatInput}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask about spending, savings, budgets…"
          />
          <button className={s.sendBtn} onClick={() => send(input)} disabled={thinking}>Send</button>
        </div>
      </div>
    </div>
  )
}
