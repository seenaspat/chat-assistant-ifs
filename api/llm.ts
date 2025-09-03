export const config = { runtime: 'edge' };

type ModelMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { messages, stream, model } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call OpenAI non-streaming for simplicity, then optionally stream the text ourselves.
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: (messages as ModelMessage[]).map((m) => ({ role: m.role, content: m.content })),
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(text, { status: response.status });
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';

    if (!stream) {
      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream words back to match the client-side simple chunk reader.
    const encoder = new TextEncoder();
    const words = text.split(' ');

    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let i = 0; i < words.length; i++) {
          const chunk = i === 0 ? words[i] : ' ' + words[i];
          controller.enqueue(encoder.encode(chunk));
          // Small delay to simulate streaming
          await new Promise((r) => setTimeout(r, 30));
        }
        controller.close();
      },
    });

    return new Response(streamBody, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


