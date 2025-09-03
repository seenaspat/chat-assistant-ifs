# IFS Therapy Conversational App

A React Native app built with Expo that provides an AI-powered conversational interface for Internal Family Systems (IFS) therapy exploration.

## Features

- 🎙️ Voice-to-text conversation with AI therapist
- 🔊 Text-to-speech responses (native + Eleven Labs)
- 💬 Conversation history management
- ⚙️ Customizable system prompts
- 📱 Cross-platform (iOS, Android, Web)

## Environment Setup

### Eleven Labs TTS (Optional)

To use high-quality AI voices, add your Eleven Labs API key:

1. Get an API key from [Eleven Labs](https://elevenlabs.io/)
2. Set the environment variable:
   ```bash
   export EXPO_PUBLIC_ELEVEN_LABS_API_KEY="your-api-key-here"
   ```
3. Enable "Use Eleven Labs TTS" in the app settings

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
   - Add `EXPO_PUBLIC_ELEVEN_LABS_API_KEY` if using Eleven Labs

### Alternative: One-command deploy

```bash
# Build and deploy in one step
bunx expo export --platform web && vercel --prod
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_ELEVEN_LABS_API_KEY` | Eleven Labs API key for high-quality TTS | No |

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