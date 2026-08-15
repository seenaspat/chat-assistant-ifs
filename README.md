# IFS Therapy Conversational App

A React Native app built with Expo that provides an AI-powered conversational interface for Internal Family Systems (IFS) therapy exploration.

## Features

- 🎙️ Voice-to-text conversation with AI therapist
- 🔊 Text-to-speech responses (native + Eleven Labs)
- 💬 Conversation history management
- ⚙️ Customizable system prompts
- 📱 Cross-platform (iOS, Android, Web)

## Environment Setup

### AI and speech credentials

AI provider credentials are read only by the server-side API routes. Never use
an `EXPO_PUBLIC_` prefix for an OpenAI, ElevenLabs, or other provider key:

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY and, optionally, ELEVENLABS_API_KEY to .env.local.
```

The Expo app calls the `/api/llm`, `/api/stt`, and `/api/tts` proxy routes via
`EXPO_PUBLIC_API_BASE_URL`; provider credentials remain in the server runtime.

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run start

# Start web version
bun run start-web
```

## Deployment to Vercel

### Prerequisites

1. Install Vercel CLI: `npm i -g vercel`
2. Create a Vercel account at [vercel.com](https://vercel.com)

### Deploy Steps

1. **Build for web:**
   ```bash
   bunx expo export --platform web
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Add `OPENAI_API_KEY`
   - Add `ELEVENLABS_API_KEY` if using ElevenLabs
   - Set `EXPO_PUBLIC_API_BASE_URL` to the deployed API origin

### Alternative: One-command deploy

```bash
# Build and deploy in one step
bunx expo export --platform web && vercel --prod
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_API_BASE_URL` | Public origin of the server-side proxy routes | Yes |
| `OPENAI_API_KEY` | Server-only LLM, transcription, and optional TTS credential | Yes |
| `ELEVENLABS_API_KEY` | Server-only ElevenLabs TTS credential | No |

## Tech Stack

- **Framework:** Expo (React Native)
- **Routing:** Expo Router
- **State Management:** React Context + AsyncStorage
- **AI:** Rork Toolkit API
- **TTS:** Expo Speech + Eleven Labs
- **STT:** Expo AV + Web Audio API
- **Styling:** React Native StyleSheet

## Project Structure

```
app/
├── _layout.tsx          # Root layout
├── index.tsx            # Main conversation screen
├── history.tsx          # Conversation history
└── settings.tsx         # App settings

components/
├── conversation-bubble.tsx
├── voice-orb.tsx
└── system-prompt-editor.tsx

hooks/
├── use-audio-recording.ts
└── use-text-to-speech.ts

providers/
└── conversation-provider.tsx
```

## License

MIT License - see LICENSE file for details.
