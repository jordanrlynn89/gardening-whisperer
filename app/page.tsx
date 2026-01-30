export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-garden-700">
            🌱 Gardening Whisperer
          </h1>
          <p className="text-xl text-earth-600">
            Your voice-first AI gardening assistant
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-4">
          <h2 className="text-2xl font-semibold text-garden-600">
            Getting Started
          </h2>
          <p className="text-earth-700">
            This is the foundation for your voice-first gardening assistant.
          </p>
          <div className="space-y-2 text-sm text-earth-600">
            <p>✓ Next.js with TypeScript</p>
            <p>✓ Tailwind CSS with earthy color palette</p>
            <p>✓ PWA-ready configuration</p>
          </div>
        </div>

        <div className="bg-garden-50 border-2 border-garden-200 rounded-lg p-6">
          <h3 className="font-semibold text-garden-700 mb-2">
            Week 1 Goal: Core Voice Loop
          </h3>
          <p className="text-sm text-earth-600">
            Next steps: Integrate Web Speech API, Gemini, and ElevenLabs
          </p>
        </div>
      </div>
    </main>
  );
}
