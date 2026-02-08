/**
 * Tests for the ACTIVE voice system: useGeminiLive hook
 *
 * Covers WebSocket lifecycle, message handling, audio state,
 * error handling, and cleanup.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';
import { useGeminiLive } from '../hooks/useGeminiLive';

// Polyfill TextEncoder/TextDecoder for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Capture the latest WebSocket instance created inside the hook
let latestWs: MockWebSocket;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  binaryType = '';
  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: '' } as CloseEvent);
  });
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    latestWs = this;
  }

  /** Simulate server opening the connection */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  /** Simulate receiving a JSON text frame */
  simulateMessage(data: Record<string, unknown>) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  /** Simulate receiving binary audio data */
  simulateBinaryMessage(buffer: ArrayBuffer) {
    if (this.onmessage) {
      this.onmessage({ data: buffer } as MessageEvent);
    }
  }

  /** Simulate a connection error */
  simulateError() {
    if (this.onerror) this.onerror(new Event('error'));
  }

  /** Simulate server closing the connection */
  simulateClose(code = 1006, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason } as unknown as CloseEvent);
    }
  }
}

// ── Global mocks ─────────────────────────────────────────────────────────────

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

// Blob + URL mocks for AudioWorklet module URL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();
global.Blob = jest.fn(() => ({ size: 0, type: 'application/javascript' })) as unknown as typeof Blob;

// AudioContext mock
class MockAudioContext {
  sampleRate = 16000;
  state = 'running';
  destination = {};
  createBuffer = jest.fn(() => ({
    getChannelData: jest.fn(() => new Float32Array(1024)),
  }));
  createBufferSource = jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null as (() => void) | null,
  }));
  createMediaStreamSource = jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));
  createGain = jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 1 },
  }));
  createScriptProcessor = jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onaudioprocess: null,
  }));
  audioWorklet = {
    addModule: jest.fn(() => Promise.resolve()),
  };
  close = jest.fn(() => Promise.resolve());
  resume = jest.fn(() => Promise.resolve());
}

global.AudioContext = MockAudioContext as unknown as typeof AudioContext;

// AudioWorkletNode mock
global.AudioWorkletNode = jest.fn(() => ({
  disconnect: jest.fn(),
  connect: jest.fn(),
  port: { onmessage: null },
})) as unknown as typeof AudioWorkletNode;

// getUserMedia mock
const mockMediaStream = {
  getTracks: jest.fn(() => [{ stop: jest.fn() }]),
};
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: jest.fn(async () => mockMediaStream) },
  writable: true,
  configurable: true,
});

// ── Helper: connect the hook so it reaches connected state ───────────────────

async function connectHook() {
  const result = renderHook(() => useGeminiLive());
  let connectPromise: Promise<void>;

  act(() => {
    connectPromise = result.result.current.connect();
  });

  // Wait a tick for the Promise.all to begin, then open the WebSocket
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    latestWs.simulateOpen();
  });

  // Let the hook settle
  await act(async () => {
    await connectPromise!.catch(() => {});
  });

  return { ...result, ws: latestWs };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useGeminiLive — WebSocket connection lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts disconnected with no errors', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it('transitions to connected after connect() + WebSocket open', async () => {
    const { result, ws } = await connectHook();

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isListening).toBe(true);
    expect(ws.binaryType).toBe('arraybuffer');
  });

  it('transitions to disconnected after disconnect()', async () => {
    const { result } = await connectHook();

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it('calls onConnected callback when connection succeeds', async () => {
    const onConnected = jest.fn();
    const { result } = renderHook(() => useGeminiLive({ onConnected }));

    let connectPromise: Promise<void>;
    act(() => {
      connectPromise = result.current.connect();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      latestWs.simulateOpen();
    });

    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    expect(onConnected).toHaveBeenCalled();
  });
});

describe('useGeminiLive — message handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles setup_complete message', async () => {
    const onConnected = jest.fn();
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'setup_complete', sessionId: 'test-session' });
    });

    // setup_complete also calls setIsConnected(true) + onConnected
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isListening).toBe(true);
  });

  it('accumulates input_transcript into userTranscript', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'Hello ' });
    });
    expect(result.current.userTranscript).toBe('Hello ');

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'world' });
    });
    expect(result.current.userTranscript).toBe('Hello world');
  });

  it('accumulates output_transcript into aiTranscript', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'output_transcript', text: 'I see ' });
    });
    expect(result.current.aiTranscript).toBe('I see ');

    act(() => {
      ws.simulateMessage({ type: 'output_transcript', text: 'yellow leaves' });
    });
    expect(result.current.aiTranscript).toBe('I see yellow leaves');
  });

  it('commits transcripts to messages on turn_complete', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'My plant is sick' });
      ws.simulateMessage({ type: 'output_transcript', text: 'Tell me more' });
      ws.simulateMessage({ type: 'turn_complete' });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'My plant is sick' });
    expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Tell me more' });
    // Transcripts should be reset after turn_complete
    expect(result.current.userTranscript).toBe('');
    expect(result.current.aiTranscript).toBe('');
  });

  it('handles interrupted message by committing partial transcripts', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'Wait' });
      ws.simulateMessage({ type: 'output_transcript', text: 'Sure, I was going to' });
      ws.simulateMessage({ type: 'interrupted' });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'Wait' });
    expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Sure, I was going to' });
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isListening).toBe(true);
  });

  it('handles error message from server', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useGeminiLive({ onError }));

    let connectPromise: Promise<void>;
    act(() => {
      connectPromise = result.current.connect();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      latestWs.simulateOpen();
    });
    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    act(() => {
      latestWs.simulateMessage({ type: 'error', message: 'API quota exceeded' });
    });

    expect(result.current.error).toBe('API quota exceeded');
    expect(onError).toHaveBeenCalledWith('API quota exceeded');
  });

  it('handles walk_complete message', async () => {
    const onWalkComplete = jest.fn();
    const { result } = renderHook(() => useGeminiLive({ onWalkComplete }));

    let connectPromise: Promise<void>;
    act(() => {
      connectPromise = result.current.connect();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      latestWs.simulateOpen();
    });
    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    act(() => {
      latestWs.simulateMessage({ type: 'walk_complete' });
    });

    expect(onWalkComplete).toHaveBeenCalled();
  });

  it('handles closed message from server', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'closed' });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it('handles binary audio data by enqueuing for playback', async () => {
    const onSpeakingStart = jest.fn();
    const { result } = renderHook(() => useGeminiLive({ onSpeakingStart }));

    let connectPromise: Promise<void>;
    act(() => {
      connectPromise = result.current.connect();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      latestWs.simulateOpen();
    });
    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    // Send binary audio — 16-bit PCM samples
    const pcmData = new Int16Array([100, -200, 300]).buffer;
    act(() => {
      latestWs.simulateBinaryMessage(pcmData);
    });

    expect(result.current.isSpeaking).toBe(true);
    expect(onSpeakingStart).toHaveBeenCalled();
  });

  it('parses JSON delivered as binary (zrok/ngrok proxy behavior)', async () => {
    const { result, ws } = await connectHook();

    // Build a jsdom-native ArrayBuffer from JSON string bytes.
    // We cannot use TextEncoder from Node's util module because jsdom has its
    // own ArrayBuffer class, and Node's ArrayBuffer fails instanceof checks.
    const jsonStr = JSON.stringify({ type: 'input_transcript', text: 'proxy test' });
    const bytes = new Uint8Array(jsonStr.length);
    for (let i = 0; i < jsonStr.length; i++) bytes[i] = jsonStr.charCodeAt(i);

    act(() => {
      ws.simulateBinaryMessage(bytes.buffer);
    });

    expect(result.current.userTranscript).toBe('proxy test');
  });
});

describe('useGeminiLive — audio state management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isSpeaking is false initially', () => {
    const { result } = renderHook(() => useGeminiLive());
    expect(result.current.isSpeaking).toBe(false);
  });

  it('isListening becomes true after connection', async () => {
    const { result } = await connectHook();
    expect(result.current.isListening).toBe(true);
  });

  it('pauseMic sets isListening to false', async () => {
    const { result } = await connectHook();

    act(() => {
      result.current.pauseMic();
    });

    expect(result.current.isListening).toBe(false);
  });

  it('resumeMic restores isListening when connected', async () => {
    const { result } = await connectHook();

    act(() => {
      result.current.pauseMic();
    });
    expect(result.current.isListening).toBe(false);

    act(() => {
      result.current.resumeMic();
    });
    expect(result.current.isListening).toBe(true);
  });
});

describe('useGeminiLive — error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets error on WebSocket connection failure', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useGeminiLive({ onError }));

    let connectPromise: Promise<void>;
    act(() => {
      connectPromise = result.current.connect();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      latestWs.simulateError();
    });

    // The connect promise should reject
    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    expect(result.current.error).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  it('sets error on unexpected WebSocket close', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useGeminiLive({ onError }));

    let connectPromise: Promise<void>;
    act(() => {
      connectPromise = result.current.connect();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      latestWs.simulateOpen();
    });
    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    // Simulate unexpected close (not code 1000)
    act(() => {
      latestWs.simulateClose(1006, 'abnormal closure');
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  it('handles invalid JSON in text messages gracefully', async () => {
    const { result, ws } = await connectHook();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    act(() => {
      if (ws.onmessage) {
        ws.onmessage({ data: '{invalid json' } as MessageEvent);
      }
    });

    // Should not crash, just log an error
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('useGeminiLive — sendText and sendImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sendText sends a JSON text message over WebSocket', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      result.current.sendText('My tomato has yellow leaves');
    });

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'text', text: 'My tomato has yellow leaves' })
    );
  });

  it('sendText does nothing when not connected', () => {
    const { result } = renderHook(() => useGeminiLive());

    act(() => {
      result.current.sendText('test');
    });

    // No WebSocket was created, so nothing should happen
    // (the function should exit early without error)
    expect(result.current.error).toBeNull();
  });

  it('sendImage sends base64 image data over WebSocket', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      result.current.sendImage('data:image/jpeg;base64,abc123', 'Look at this');
    });

    const sent = JSON.parse(ws.send.mock.calls[ws.send.mock.calls.length - 1][0]);
    expect(sent.type).toBe('image');
    expect(sent.imageData).toBe('abc123'); // prefix stripped
    expect(sent.text).toBe('Look at this');
  });

  it('sendImage uses default text when none provided', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      result.current.sendImage('abc123');
    });

    const sent = JSON.parse(ws.send.mock.calls[ws.send.mock.calls.length - 1][0]);
    expect(sent.text).toBe('Here is a photo of my plant. What do you see?');
  });
});

describe('useGeminiLive — cleanup on unmount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cleans up resources when disconnect is called', async () => {
    const { result } = await connectHook();

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
  });
});
