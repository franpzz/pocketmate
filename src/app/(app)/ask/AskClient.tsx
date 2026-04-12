'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { monthlyIncome, totalOut, leftover, ytd, currentMonth, cycleLabel } from '@/lib/finance'
import s from './ask.module.css'

interface Message { role: 'user' | 'ai'; html: string }

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
  const { profile, fixedExpenses, monthlySavings, cycleState, loading } = useAppState()
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
    let intro: string
    if (cycleState.has_first_pay) {
      intro = `Hey ${profile.name}! Your wallet is **$${Math.abs(cycleState.wallet).toLocaleString()}**${cycleState.wallet < 0 ? ' overdrawn' : ''}. You've locked in **$${locked.toLocaleString()}** in savings this month. What would you like to know?`
    } else {
      intro = `Hey ${profile.name}! Tap **"I got paid"** on the dashboard to start your first cycle. Your pay is $${profile.income.toLocaleString()} per ${cycleLabel(profile.cadence)}. What would you like to know?`
    }
    setMessages([{ role: 'ai', html: md(intro) }])
  }, [profile, cycleState, monthlySavings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function buildResponse(msg: string): string {
    if (!profile) return 'Still loading your data…'
    const lc    = msg.toLowerCase()
    const cm    = currentMonth()
    const months = monthlySavings?.months ?? new Array(12).fill(0)
    const locked = months[cm] ?? 0
    const pct   = Math.min(100, Math.round(locked / Math.max(profile.monthly_target, 1) * 100))
    const left  = Math.max(0, leftover(profile.income, profile.cadence, profile.extra, fixedExpenses, profile.groceries, profile.dining, profile.transport, profile.entertainment))
    const ytdAmt = ytd(months)
    const incM  = monthlyIncome(profile.income, profile.cadence, profile.extra)
    const outM  = Math.round(totalOut(fixedExpenses, profile.groceries, profile.dining, profile.transport, profile.entertainment))

    if (lc.includes('track')) {
      return `You've locked in **$${locked.toLocaleString()}** this month — **${pct}%** of your $${profile.monthly_target.toLocaleString()} target. Your projected cycle leftover is **$${left.toLocaleString()}**. ${locked >= profile.monthly_target ? "Great job, you're above target! 🎉" : 'Keep going!'}`
    }
    if (lc.includes('overspend') || lc.includes('too much')) {
      return `Your biggest variable spend is **Dining out at $${profile.dining.toLocaleString()}/wk**. Cutting one meal out per week could save ~$${profile.dining}. Your groceries at $${profile.groceries.toLocaleString()}/wk look reasonable.`
    }
    if (lc.includes('goal') || lc.includes('when')) {
      const remain = profile.monthly_target * 12 - ytdAmt
      return `You've saved **$${ytdAmt.toLocaleString()}** this year. ${remain > 0 ? "At your current rate you're tracking well toward your yearly target." : '🎉 Annual target reached!'}`
    }
    if (lc.includes('save more') || lc.includes('tips')) {
      return 'Three quick wins: **1.** Cook one extra dinner at home per week (saves ~$80/mo). **2.** Review subscriptions — Netflix, Spotify, etc. **3.** Use the Shopping List to meal-plan and cut grocery waste (~$20–40/mo).'
    }
    return `Based on your numbers: income **$${incM.toLocaleString()}/mo**, outgoings **$${outM.toLocaleString()}/mo**, leaving **$${left.toLocaleString()}** per cycle. Want me to dig into anything specific?`
  }

  function send(msg: string) {
    msg = msg.trim()
    if (!msg || thinking) return
    setMessages(prev => [...prev, { role: 'user', html: msg }])
    setInput('')
    setThinking(true)
    setTimeout(() => {
      const resp = buildResponse(msg)
      setMessages(prev => [...prev, { role: 'ai', html: md(resp) }])
      setThinking(false)
    }, 600)
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
          <button className={s.sendBtn} onClick={() => send(input)}>Send</button>
        </div>
      </div>
    </div>
  )
}
