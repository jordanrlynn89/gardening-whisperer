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
        // Call the API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            conversationHistory: messages,
            imageData,
          }),
        });

        const data: ChatApiResponse = await response.json();

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
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Chat error:', err);
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
