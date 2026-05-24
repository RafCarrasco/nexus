import { NextResponse } from 'next/server';
import { auth } from '@/auth/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });

  const body = (await req.json()) as {
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model: string;
    messages: Msg[];
  };

  if (!body.apiKey) return new NextResponse('apiKey required', { status: 400 });
  if (!body.messages?.length) return new NextResponse('messages required', { status: 400 });

  try {
    if (body.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': body.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: body.model || 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: body.messages,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return new NextResponse(`Anthropic: ${text}`, { status: res.status });
      }
      const json = (await res.json()) as { content: Array<{ type: string; text: string }> };
      const reply = json.content?.filter((c) => c.type === 'text').map((c) => c.text).join('\n') ?? '';
      return NextResponse.json({ reply });
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${body.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: body.model || 'gpt-4o-mini',
          messages: body.messages,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return new NextResponse(`OpenAI: ${text}`, { status: res.status });
      }
      const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      const reply = json.choices?.[0]?.message?.content ?? '';
      return NextResponse.json({ reply });
    }
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 502 });
  }
}
