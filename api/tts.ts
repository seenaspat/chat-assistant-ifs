import { elevenlabs } from "@ai-sdk/elevenlabs";
import { experimental_generateSpeech as generateSpeech } from "ai";
export const config = { runtime: "edge" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request): Promise<Response> {
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
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing ELEVENLABS_API_KEY" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const body: any = await req.json();
    const text: string | undefined = body?.text;
    const voice: string = body?.voice ?? "pNInz6obpgDQGcFmaJgB";
    const modelId: string =
      body?.modelId ?? body?.model_id ?? "eleven_multilingual_v2";

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const result: any = await generateSpeech({
      model: elevenlabs.speech(modelId),
      text,
      providerOptions: { elevenlabs: { voice } },
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Try multiple shapes for audio data to be robust
    const audio = result?.audio ?? result;
    let bytes: Uint8Array | null = null;
    if (audio?.uint8Array) bytes = audio.uint8Array as Uint8Array;
    else if (audio?.audioData) bytes = audio.audioData as Uint8Array;
    else if (audio instanceof Uint8Array) bytes = audio as Uint8Array;
    else if (typeof audio?.arrayBuffer === "function") {
      const buf = await audio.arrayBuffer();
      bytes = new Uint8Array(buf);
    }

    if (!bytes) {
      return new Response(JSON.stringify({ error: "No audio generated" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
