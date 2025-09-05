import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { experimental_generateSpeech as generateSpeech } from "ai";
export const config = { runtime: "edge" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request): Promise<Response> {
  try {
    console.log("[API/TTS] method=", req.method);
  } catch {}
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    // Lightweight voice list proxy for Settings UI
    try {
      const apiKey =
        process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing ELEVENLABS_API_KEY" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      try {
        console.log("[API/TTS] GET /voices upstream status=", upstream.status);
      } catch {}
      if (!upstream.ok) {
        const err = await upstream.text().catch(() => "Upstream error");
        try {
          console.error("[API/TTS] GET /voices upstream error=", err);
        } catch {}
        return new Response(
          JSON.stringify({ error: "Failed to fetch voices", details: err }),
          {
            status: upstream.status,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      const data = await upstream.json();
      // Normalize minimal fields we use to reduce payload
      const voices = (data?.voices || []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
        preview_url: v.preview_url,
      }));
      try {
        console.log("[API/TTS] GET voices count=", voices.length);
      } catch {}
      return new Response(JSON.stringify({ voices }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err: any) {
      try {
        console.error("[API/TTS] GET voices error=", err?.message || err);
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

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const apiKey =
      process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      console.error("[TTS] Missing ELEVENLABS_API_KEY");
      return new Response(
        JSON.stringify({ error: "Missing ELEVENLABS_API_KEY" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const body: any = await req.json();
    const action: string | undefined = body?.action;

    if (action === "voices") {
      try {
        const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": apiKey },
        });
        console.log(
          "[API/TTS] POST action=voices upstream status=",
          upstream.status
        );
        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "Upstream error");
          return new Response(
            JSON.stringify({
              error: `ElevenLabs error: ${upstream.status}`,
              details: errText,
            }),
            {
              status: upstream.status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
        const data = await upstream.json();
        const voices = (data?.voices || []).map((v: any) => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category,
          labels: v.labels,
          preview_url: v.preview_url,
        }));
        return new Response(JSON.stringify({ voices }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        console.error(
          "[API/TTS] POST action=voices error:",
          err?.message || err
        );
        return new Response(
          JSON.stringify({ error: err?.message || "Unknown error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

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

    try {
      const provider = createElevenLabs({ apiKey });
      const result: any = await generateSpeech({
        model: provider.speech(modelId),
        text,
        providerOptions: { elevenlabs: { voice } },
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

      if (bytes) {
        return new Response(bytes, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg", ...corsHeaders },
        });
      }
      console.error("[TTS] No audio from SDK, falling back to REST");
    } catch (sdkErr: any) {
      // Fall through to REST on any auth/SDK error
      console.error(
        "[TTS] SDK path failed, falling back to REST:",
        sdkErr?.message || sdkErr
      );
    }

    // Fallback: direct REST call with xi-api-key
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.5 },
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "Upstream error");
      return new Response(
        JSON.stringify({
          error: `ElevenLabs error: ${upstream.status}`,
          details: errText,
        }),
        {
          status: upstream.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[TTS] Error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
