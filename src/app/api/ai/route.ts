import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { systemPrompt, messages } = await req.json() as {
    systemPrompt?: string
    messages: ChatMessage[]
  }

  const contents = messages.map(m => ({
    role: m.role === 'ai' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }))

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('Gemini fetch error:', err)
    return NextResponse.json({ error: 'network_error' }, { status: 502 })
  }

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Gemini ${res.status}:`, errBody)
    return NextResponse.json({ error: 'gemini_error', status: res.status, detail: errBody }, { status: 502 })
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return NextResponse.json({ text })
}
