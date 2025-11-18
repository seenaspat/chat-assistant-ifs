export const config = { runtime: "edge" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export default async function handler(req: Request): Promise<Response> {
  try {
    console.log("[API/LLM] method=", req.method);
  } catch {}
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const start = Date.now();
    const { messages, stream, model } = await req.json();
    try {
      console.log(
        "[API/LLM] req stream=",
        !!stream,
        "model=",
        model,
        "messages=",
        Array.isArray(messages) ? messages.length : 0
      );
    } catch {}

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Call OpenAI non-streaming for simplicity, then optionally stream the text ourselves.
    const targetModel: string = model || "gpt-5.1";
    const isResponsesModel = targetModel.startsWith("gpt-5.1");

    const upstreamUrl = isResponsesModel
      ? "https://api.openai.com/v1/responses"
      : "https://api.openai.com/v1/chat/completions";

    const payload = isResponsesModel
      ? {
          model: targetModel,
          reasoning: { effort: "medium" as const },
          modalities: ["text"] as const,
          input: (messages as ModelMessage[]).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }
      : {
          model: targetModel,
          messages: (messages as ModelMessage[]).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
        };

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        console.error("[API/LLM] upstream error status=", response.status);
      } catch {}
      return new Response(text, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    const data = await response.json();
    const text: string = isResponsesModel
      ? data?.output_text?.join("") ?? ""
      : data?.choices?.[0]?.message?.content ?? "";
    try {
      console.log(
        "[API/LLM] success text len=",
        text?.length || 0,
        "elapsedMs=",
        Date.now() - start
      );
    } catch {}

    if (!stream) {
      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Stream words back to match the client-side simple chunk reader.
    const encoder = new TextEncoder();
    const words = text.split(" ");

    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let i = 0; i < words.length; i++) {
          const chunk = i === 0 ? words[i] : " " + words[i];
          controller.enqueue(encoder.encode(chunk));
          // Small delay to simulate streaming
          await new Promise((r) => setTimeout(r, 30));
        }
        controller.close();
      },
    });

    return new Response(streamBody, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
    });
  } catch (err: any) {
    try {
      console.error("[API/LLM] error=", err?.message || err);
    } catch {}
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
