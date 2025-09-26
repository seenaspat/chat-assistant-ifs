import { ModelMessage } from "ai";

// Rork Toolkit Provider (current implementation)
export const rorkProvider = {
  generateText: async ({ messages }: { messages: ModelMessage[] }) => {
    const response = await fetch("https://toolkit.rork.com/text/llm/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    return { text: data.completion };
  },

  generateTextStream: async function* ({
    messages,
  }: {
    messages: ModelMessage[];
  }) {
    const response = await fetch("https://toolkit.rork.com/text/llm/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    const text = data.completion;

    // Simulate streaming by yielding words
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = i === 0 ? words[i] : " " + words[i];
      yield { text: chunk };
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  },
};

// Proxy Provider (Vercel/Edge or any serverless backend)
export const proxyProvider = {
  generateText: async ({ messages }: { messages: ModelMessage[] }) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
    const response = await fetch(`${baseUrl}/api/llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!response.ok) throw new Error("Proxy LLM failed");
    const data = await response.json();
    return { text: data.text };
  },
  generateTextStream: async function* ({
    messages,
  }: {
    messages: ModelMessage[];
  }) {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
    const response = await fetch(`${baseUrl}/api/llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, stream: true }),
    });
    if (!response.ok || !response.body)
      throw new Error("Proxy LLM stream failed");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        yield { text: chunk };
      }
    } finally {
      reader.releaseLock();
    }
  },
};

// Vercel AI Gateway Provider (for when you want to use other models)
// This would work with OpenAI, Anthropic, etc. through Vercel AI Gateway
export const createVercelGatewayProvider = (
  apiKey: string,
  baseURL?: string
) => {
  return {
    generateText: async ({
      messages,
      model = "gpt-4",
    }: {
      messages: ModelMessage[];
      model?: string;
    }) => {
      // Direct API call to Vercel AI Gateway
      const response = await fetch(
        baseURL || "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response from AI Gateway");
      }

      const data = await response.json();
      return { text: data.choices[0].message.content };
    },

    generateTextStream: async function* ({
      messages,
      model = "gpt-4",
    }: {
      messages: ModelMessage[];
      model?: string;
    }) {
      const response = await fetch(
        baseURL || "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response from AI Gateway");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  yield { text: content };
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
};

// Example usage with different providers:
//
// // Using Rork Toolkit (current)
// const provider = rorkProvider;
//
// // Using OpenAI through Vercel AI Gateway
// const provider = createVercelGatewayProvider(
//   'your-openai-api-key',
//   'https://gateway.ai.cloudflare.com/v1/your-account/your-gateway/openai/v1/chat/completions'
// );
//
// // Using Anthropic through Vercel AI Gateway
// const provider = createVercelGatewayProvider(
//   'your-anthropic-api-key',
//   'https://gateway.ai.cloudflare.com/v1/your-account/your-gateway/anthropic/v1/messages'
// );
//
// // Using direct OpenAI API
// const provider = createVercelGatewayProvider('your-openai-api-key');

// Remote TTS Provider (via secure proxy) supporting ElevenLabs and OpenAI
export const elevenLabsProvider = {
  generateSpeech: async ({
    text,
    voice,
    provider,
    speed,
  }: {
    text: string;
    voice?: string;
    provider?: "elevenlabs" | "openai";
    speed?: number;
  }) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
    try {
      console.log("[TTS] Calling /api/tts", {
        baseUrl,
        voice,
        provider,
        textLen: text?.length,
        speed,
      });
      const response = await fetch(`${baseUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, provider, speed }),
      });

      console.log(
        "[TTS] /api/tts status",
        response.status,
        response.headers.get("content-type")
      );
      if (!response.ok) {
        const message = await response.text().catch(() => `${response.status}`);
        console.error("[TTS] Error body:", message);
        throw new Error(`TTS proxy error: ${message}`);
      }

      return response;
    } catch (error) {
      console.error("TTS proxy call failed:", error);
      throw error;
    }
  },
};

export type AIProvider = typeof rorkProvider;

// Configuration interface for easy provider switching
export interface AIConfig {
  provider: "proxy" | "rork" | "vercel-gateway" | "elevenlabs";
  apiKey?: string;
  baseURL?: string;
  model?: string;
  voice?: string;
}

// Factory function to create providers based on config
export const createAIProvider = (config: AIConfig): AIProvider => {
  switch (config.provider) {
    case "proxy":
      return proxyProvider as any;
    case "rork":
      return rorkProvider;
    case "vercel-gateway":
      if (!config.apiKey) {
        throw new Error("API key required for Vercel AI Gateway");
      }
      return createVercelGatewayProvider(config.apiKey, config.baseURL);
    case "elevenlabs":
      return elevenLabsProvider as any;
    default:
      return proxyProvider as any;
  }
};
