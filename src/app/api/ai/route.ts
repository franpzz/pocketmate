import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { systemPrompt, messages } = await req.json() as {
    systemPrompt?: string
    messages: ChatMessage[]
  }

  // Build OpenAI-compatible messages array
  const groqMessages: { role: string; content: string }[] = []
  if (systemPrompt) {
    groqMessages.push({ role: 'system', content: systemPrompt })
  }
  for (const m of messages) {
    groqMessages.push({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    })
  }

  let res: Response
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
      }),
    })
  } catch (err) {
    console.error('Groq fetch error:', err)
    return NextResponse.json({ error: 'network_error' }, { status: 502 })
  }

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Groq ${res.status}:`, errBody)
    return NextResponse.json({ error: 'groq_error', status: res.status, detail: errBody }, { status: 502 })
  }

  const data = await res.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  return NextResponse.json({ text })
}
