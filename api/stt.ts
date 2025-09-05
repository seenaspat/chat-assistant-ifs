export const config = { runtime: "nodejs" };

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
    // Keep uploads small to avoid platform limits
    const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
    const UPSTREAM_TIMEOUT_MS = 60_000; // 60s

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Expect multipart/form-data with 'audio' field
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const formData = await req.formData();
    const file = (formData as any).get("audio");
    // Debug headers for troubleshooting
    // console.log('STT: content-type', contentType, 'file is File?', file instanceof File, 'name', (file as any)?.name);
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (
      typeof (file as File).size === "number" &&
      (file as File).size > MAX_FILE_BYTES
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Audio too large. Please keep recordings under 2 minutes (<= 20MB).",
          details: { size: (file as File).size },
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let openaiRes: Response;
    try {
      openaiRes = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: (() => {
            const fd = new FormData();
            fd.append("file", file, (file as File).name || "audio.webm");
            fd.append("model", "whisper-1");
            return fd;
          })(),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!openaiRes.ok) {
      const contentTypeUp = openaiRes.headers.get("content-type") || "";
      let details: string | object = "";
      if (contentTypeUp.includes("application/json")) {
        try {
          details = await openaiRes.json();
        } catch {
          details = await openaiRes.text().catch(() => "");
        }
      } else {
        details = await openaiRes.text().catch(() => "");
      }
      return new Response(
        JSON.stringify({ error: "Upstream STT failed", details }),
        {
          status: openaiRes.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const data = await openaiRes.json();
    const text = data?.text || "";
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    const message = isAbort
      ? "Transcription timed out. Please try a shorter recording."
      : err?.message || "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: isAbort ? 504 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
