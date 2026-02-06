import { useState, useCallback } from 'react';
import { ChatMessage, GeminiResponse, ChatApiResponse } from '@/types/chat';

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string, imageData?: string) => Promise<GeminiResponse | null>;
  clearMessages: () => void;
  lastResponse: GeminiResponse | null;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<GeminiResponse | null>(null);

  const sendMessage = useCallback(
    async (message: string, imageData?: string): Promise<GeminiResponse | null> => {
      setIsLoading(true);
      setError(null);

      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // CRITICAL FIX: Build history that includes current message
        // The closure captures `messages` at callback creation time, so it's stale.
        // We must explicitly include the userMessage we just created.
        const historyToSend = [...messages, userMessage];

        console.log('[useChat] Sending message, has image:', !!imageData);

        // Call the API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            conversationHistory: historyToSend,
            imageData,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data: ChatApiResponse = await response.json();
        console.log('[useChat] Received response:', data.success);

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Failed to get response');
        }

        const geminiResponse = data.data;

        // Add assistant message to history
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: geminiResponse.spokenResponse,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setLastResponse(geminiResponse);

        return geminiResponse;
      } catch (err) {
        let errorMessage = 'Unknown error';

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            errorMessage = 'Request timed out. Please try again.';
            console.error('[useChat] Request timed out after 30s');
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        console.error('[useChat] Error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastResponse(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    lastResponse,
  };
}
