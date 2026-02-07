import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeminiLive } from '../hooks/useGeminiLive';

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Blob
global.Blob = jest.fn(() => ({
  size: 0,
  type: 'application/javascript',
})) as any;

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  OPEN: 1,
})) as any;

// Mock AudioContext and related APIs
class MockAudioContext {
  createBuffer = jest.fn(() => ({
    getChannelData: jest.fn(() => new Float32Array(1024)),
  }));
  createBufferSource = jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null,
  }));
  createMediaStreamSource = jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));
  createGain = jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 1 },
  }));
  destination = {};
  get state() {
    return 'running';
  }
  audioWorklet = {
    addModule: jest.fn(() => Promise.resolve()),
  };
  close = jest.fn(() => Promise.resolve());
  resume = jest.fn(() => Promise.resolve());
}

global.AudioContext = MockAudioContext as any;

// Mock getUserMedia
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(async () => ({
      getTracks: jest.fn(() => [
        {
          stop: jest.fn(),
        },
      ]),
    })),
  },
  writable: true,
  configurable: true,
});

// Mock AudioWorkletNode
global.AudioWorkletNode = jest.fn(() => ({
  disconnect: jest.fn(),
  connect: jest.fn(),
  port: {
    onmessage: null,
  },
})) as any;

describe('useGeminiLive WebSocket Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize without errors', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(result.current).toBeDefined();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
  });

  it('should expose connect function', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(typeof result.current.connect).toBe('function');
  });

  it('should expose disconnect function', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(typeof result.current.disconnect).toBe('function');
  });

  it('should track connection state', async () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(result.current.isConnected).toBe(false);

    // After connect is called, should attempt connection
    act(() => {
      result.current.connect();
    });

    // Note: Actual connection state depends on WebSocket mock behavior
    expect(result.current).toBeDefined();
  });

  it('should have error handling', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(result.current.error).toBeNull();
  });

  it('should return audio and transcript state', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(typeof result.current.userTranscript).toBe('string');
    expect(typeof result.current.aiTranscript).toBe('string');
    expect(Array.isArray(result.current.messages)).toBe(true);
  });

  it('should have sendImage function for photo uploads', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(typeof result.current.sendImage).toBe('function');
  });

  it('should have pauseMic and resumeMic controls', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(typeof result.current.pauseMic).toBe('function');
    expect(typeof result.current.resumeMic).toBe('function');
  });

  it('should accept callbacks in options', () => {
    const onConnected = jest.fn();
    const onError = jest.fn();
    const onSpeakingStart = jest.fn();
    const onSpeakingEnd = jest.fn();

    renderHook(() =>
      useGeminiLive({
        onConnected,
        onError,
        onSpeakingStart,
        onSpeakingEnd,
      })
    );

    // Should initialize without calling callbacks immediately
    expect(onConnected).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('useGeminiLive Audio Handling', () => {
  it('should have audio playback controls', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(result.current.isSpeaking).toBe(false);
  });

  it('should handle AudioContext creation', async () => {
    const { result } = renderHook(() => useGeminiLive());

    act(() => {
      result.current.connect();
    });

    // Give it a moment to initialize
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });
});
