import { renderHook, act } from '@testing-library/react';
import { useSpeechCommand } from '@/hooks/useSpeechCommand';

// ── Mock SpeechRecognition ──

let mockInstance: {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function createMockInstance() {
  mockInstance = {
    continuous: false,
    interimResults: false,
    lang: '',
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    onresult: null,
    onerror: null,
    onend: null,
  };
  return mockInstance;
}

function makeSpeechResult(transcript: string, isFinal: boolean) {
  return {
    results: [
      [{ transcript }],
    ],
    resultIndex: 0,
  } as unknown;
  // SpeechRecognitionEvent shape — results[0][0].transcript, results[0].isFinal
  // We patch isFinal onto results[0] since it's a property of the SpeechRecognitionResult
}

function makeSpeechResultWithFinal(transcript: string, isFinal: boolean) {
  const result = [{ transcript }] as unknown as SpeechRecognitionAlternative[] & { isFinal: boolean };
  (result as { isFinal: boolean }).isFinal = isFinal;
  return {
    results: [result],
    resultIndex: 0,
  };
}

beforeAll(() => {
  (window as unknown as Record<string, unknown>).SpeechRecognition = jest.fn(createMockInstance);
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = jest.fn(createMockInstance);
});

afterAll(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

// ── Tests ──

describe('useSpeechCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns isListening=false initially', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    expect(result.current.isListening).toBe(false);
  });

  it('sets isListening=true after start()', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });

    expect(result.current.isListening).toBe(true);
    expect(mockInstance.start).toHaveBeenCalledTimes(1);
  });

  it('sets isListening=false after stop()', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.isListening).toBe(false);
    expect(mockInstance.stop).toHaveBeenCalledTimes(1);
  });

  it('configures continuous and interimResults on start', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });

    expect(mockInstance.continuous).toBe(true);
    expect(mockInstance.interimResults).toBe(true);
  });

  it('delivers interim transcript via onTranscript callback', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });

    const event = makeSpeechResultWithFinal('take pho', false);
    act(() => {
      mockInstance.onresult?.(event);
    });

    expect(onTranscript).toHaveBeenCalledWith('take pho', false);
  });

  it('delivers final transcript via onTranscript callback', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });

    const event = makeSpeechResultWithFinal('take photo', true);
    act(() => {
      mockInstance.onresult?.(event);
    });

    expect(onTranscript).toHaveBeenCalledWith('take photo', true);
  });

  it('auto-restarts recognition when it ends while still listening', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });
    expect(mockInstance.start).toHaveBeenCalledTimes(1);

    // Simulate speech recognition ending (e.g., after silence)
    act(() => {
      mockInstance.onend?.();
    });

    // Should have restarted
    expect(mockInstance.start).toHaveBeenCalledTimes(2);
    expect(result.current.isListening).toBe(true);
  });

  it('does not restart after explicit stop()', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.stop();
    });

    // Simulate onend after stop
    act(() => {
      mockInstance.onend?.();
    });

    // Should NOT restart — only the initial start call
    expect(mockInstance.start).toHaveBeenCalledTimes(1);
  });

  it('handles recognition errors without crashing', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });

    // Fire an error event
    act(() => {
      mockInstance.onerror?.({ error: 'no-speech' });
    });

    // Should still be in listening state (auto-restart handles recovery)
    expect(result.current.isListening).toBe(true);
  });

  it('cleans up on unmount by calling abort()', () => {
    const onTranscript = jest.fn();
    const { result, unmount } = renderHook(() => useSpeechCommand({ onTranscript }));

    act(() => {
      result.current.start();
    });

    unmount();

    expect(mockInstance.abort).toHaveBeenCalledTimes(1);
  });

  it('does not crash when SpeechRecognition API is unavailable', () => {
    // Temporarily remove the API
    const saved = (window as unknown as Record<string, unknown>).SpeechRecognition;
    const savedWebkit = (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    // start() should be a no-op
    act(() => {
      result.current.start();
    });

    expect(result.current.isListening).toBe(false);

    // Restore
    (window as unknown as Record<string, unknown>).SpeechRecognition = saved;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = savedWebkit;
  });

  it('stop() is safe to call when not listening', () => {
    const onTranscript = jest.fn();
    const { result } = renderHook(() => useSpeechCommand({ onTranscript }));

    // Should not throw
    act(() => {
      result.current.stop();
    });

    expect(result.current.isListening).toBe(false);
  });
});
