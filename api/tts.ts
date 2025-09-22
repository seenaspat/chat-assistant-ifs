// SDK imports removed; using REST path for reliability
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
      const url = new URL(req.url);
      const providerParam = url.searchParams.get("provider")?.toLowerCase();
      const provider = (
        providerParam ||
        process.env.TTS_PROVIDER ||
        "openai"
      ).toLowerCase();

      if (provider === "openai") {
        // Static OpenAI voice list (normalized to ElevenLabs shape)
        const openAIVoices = [
          "fable",
          "alloy",
          "verse",
          "onyx",
          "nova",
          "shimmer",
        ];
        const voices = openAIVoices.map((name) => ({
          voice_id: name,
          name,
          preview_url: null,
        }));
        try {
          console.log(
            "[API/TTS] GET voices provider=openai count=",
            voices.length
          );
        } catch {}
        return new Response(JSON.stringify({ voices }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Default to ElevenLabs
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
    const body: any = await req.json();
    const action: string | undefined = body?.action;
    const provider = (
      body?.provider ||
      process.env.TTS_PROVIDER ||
      "openai"
    ).toLowerCase();

    if (action === "voices") {
      if (provider === "openai") {
        const openAIVoices = [
          "fable",
          "alloy",
          "verse",
          "onyx",
          "nova",
          "shimmer",
        ];
        const voices = openAIVoices.map((name) => ({
          voice_id: name,
          name,
          preview_url: null,
        }));
        return new Response(JSON.stringify({ voices }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ElevenLabs voices
      try {
        const elevenKey =
          process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
        if (!elevenKey) {
          return new Response(
            JSON.stringify({ error: "Missing ELEVENLABS_API_KEY" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
        const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": elevenKey },
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
    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (provider === "openai") {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const allowedVoices = new Set([
        "fable",
        "alloy",
        "verse",
        "onyx",
        "nova",
        "shimmer",
      ]);
      const requestedVoice: string | undefined = body?.voice;
      const envVoice: string | undefined = process.env.OPENAI_TTS_VOICE;
      const voiceName: string =
        requestedVoice && allowedVoices.has(requestedVoice)
          ? requestedVoice
          : envVoice && allowedVoices.has(envVoice)
          ? envVoice
          : "fable"; // gentle, warm tone
      const model: string =
        body?.model || process.env.OPENAI_TTS_MODEL || "tts-1";

      const openaiBase =
        process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      const upstream = await fetch(
        `${openaiBase.replace(/\/$/, "")}/audio/speech`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model,
            voice: voiceName,
            input: text,
            response_format: "mp3",
          }),
        }
      );

      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "Upstream error");
        return new Response(
          JSON.stringify({
            error: `OpenAI TTS error: ${upstream.status}`,
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
    }

    // ElevenLabs default
    const elevenKey =
      process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
    if (!elevenKey) {
      console.error("[TTS] Missing ELEVENLABS_API_KEY");
      return new Response(
        JSON.stringify({ error: "Missing ELEVENLABS_API_KEY" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const voice: string = body?.voice ?? "pNInz6obpgDQGcFmaJgB";
    const modelId: string =
      body?.modelId ?? body?.model_id ?? "eleven_multilingual_v2";

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": elevenKey,
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
