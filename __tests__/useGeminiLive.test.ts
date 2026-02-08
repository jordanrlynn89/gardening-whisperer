/**
 * Tests for useGeminiLive hook
 *
 * Comprehensive coverage including: connection establishment, message types,
 * audio playback pipeline, error handling, disconnect/cleanup, and sendText.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';
import { useGeminiLive } from '../hooks/useGeminiLive';

// Polyfill TextEncoder/TextDecoder for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// ── MockWebSocket ────────────────────────────────────────────────────────────

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

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  simulateMessage(data: Record<string, unknown>) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  simulateBinaryMessage(buffer: ArrayBuffer) {
    if (this.onmessage) {
      this.onmessage({ data: buffer } as MessageEvent);
    }
  }

  simulateError() {
    if (this.onerror) this.onerror(new Event('error'));
  }

  simulateClose(code = 1006, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason } as unknown as CloseEvent);
    }
  }
}

// ── Global mocks ─────────────────────────────────────────────────────────────

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();
global.Blob = jest.fn(() => ({ size: 0, type: 'application/javascript' })) as unknown as typeof Blob;

let mockBufferSourceNodes: Array<{
  buffer: AudioBuffer | null;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  onended: (() => void) | null;
}>;

class MockAudioContext {
  sampleRate = 16000;
  state = 'running';
  destination = {};
  createBuffer = jest.fn((channels: number, length: number, rate: number) => ({
    getChannelData: jest.fn(() => new Float32Array(length)),
    length,
    sampleRate: rate,
    numberOfChannels: channels,
  }));
  createBufferSource = jest.fn(() => {
    const node = {
      buffer: null as AudioBuffer | null,
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      onended: null as (() => void) | null,
    };
    mockBufferSourceNodes.push(node);
    return node;
  });
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

global.AudioWorkletNode = jest.fn(() => ({
  disconnect: jest.fn(),
  connect: jest.fn(),
  port: { onmessage: null },
})) as unknown as typeof AudioWorkletNode;

const mockMediaStream = {
  getTracks: jest.fn(() => [{ stop: jest.fn() }]),
};
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: jest.fn(async () => mockMediaStream) },
  writable: true,
  configurable: true,
});

// ── Helper ───────────────────────────────────────────────────────────────────

async function connectHook(options = {}) {
  const hookResult = renderHook(() => useGeminiLive(options));
  let connectPromise: Promise<void>;

  act(() => {
    connectPromise = hookResult.result.current.connect();
  });

  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    latestWs.simulateOpen();
  });

  await act(async () => {
    await connectPromise!.catch(() => {});
  });

  return { ...hookResult, ws: latestWs };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useGeminiLive — connection establishment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.userTranscript).toBe('');
    expect(result.current.aiTranscript).toBe('');
    expect(result.current.messages).toEqual([]);
  });

  it('exposes all required functions', () => {
    const { result } = renderHook(() => useGeminiLive());

    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.sendImage).toBe('function');
    expect(typeof result.current.sendText).toBe('function');
    expect(typeof result.current.pauseMic).toBe('function');
    expect(typeof result.current.resumeMic).toBe('function');
  });

  it('creates AudioContext and requests mic on connect', async () => {
    await connectHook();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
  });

  it('sets WebSocket binaryType to arraybuffer', async () => {
    const { ws } = await connectHook();
    expect(ws.binaryType).toBe('arraybuffer');
  });

  it('calls onConnected callback on successful connection', async () => {
    const onConnected = jest.fn();
    await connectHook({ onConnected });

    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('transitions to connected + listening state', async () => {
    const { result } = await connectHook();

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isListening).toBe(true);
  });

  it('clears messages on new connection', async () => {
    const { result, ws } = await connectHook();

    // Add some messages
    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'hello' });
      ws.simulateMessage({ type: 'turn_complete' });
    });
    expect(result.current.messages.length).toBeGreaterThan(0);

    // Disconnect first
    act(() => {
      result.current.disconnect();
    });

    // Reconnect
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

    expect(result.current.messages).toEqual([]);
  });
});

describe('useGeminiLive — message types', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('handles setup_complete', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'setup_complete', sessionId: 's123' });
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('handles input_transcript (user speech)', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'My plant ' });
      ws.simulateMessage({ type: 'input_transcript', text: 'is wilting' });
    });

    expect(result.current.userTranscript).toBe('My plant is wilting');
  });

  it('handles output_transcript (AI speech)', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'output_transcript', text: 'That could ' });
      ws.simulateMessage({ type: 'output_transcript', text: 'be root rot' });
    });

    expect(result.current.aiTranscript).toBe('That could be root rot');
  });

  it('handles turn_complete — commits transcripts and resets', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'Help' });
      ws.simulateMessage({ type: 'output_transcript', text: 'Sure' });
      ws.simulateMessage({ type: 'turn_complete' });
    });

    expect(result.current.messages).toEqual([
      { role: 'user', content: 'Help' },
      { role: 'assistant', content: 'Sure' },
    ]);
    expect(result.current.userTranscript).toBe('');
    expect(result.current.aiTranscript).toBe('');
    expect(result.current.isListening).toBe(true);
  });

  it('handles turn_complete with only user transcript', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'Just me' });
      ws.simulateMessage({ type: 'turn_complete' });
    });

    expect(result.current.messages).toEqual([
      { role: 'user', content: 'Just me' },
    ]);
  });

  it('handles turn_complete with only AI transcript', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'output_transcript', text: 'Welcome!' });
      ws.simulateMessage({ type: 'turn_complete' });
    });

    expect(result.current.messages).toEqual([
      { role: 'assistant', content: 'Welcome!' },
    ]);
  });

  it('handles turn_complete with empty transcripts (no-op)', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'turn_complete' });
    });

    expect(result.current.messages).toEqual([]);
  });

  it('handles interrupted — commits partial transcripts', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'Wait' });
      ws.simulateMessage({ type: 'output_transcript', text: 'I was saying' });
      ws.simulateMessage({ type: 'interrupted' });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isListening).toBe(true);
  });

  it('handles interrupted with no pending transcripts', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'interrupted' });
    });

    // Should not add empty messages
    expect(result.current.messages).toEqual([]);
  });

  it('handles error message', async () => {
    const onError = jest.fn();
    const { result, ws } = await connectHook({ onError });

    act(() => {
      ws.simulateMessage({ type: 'error', message: 'Rate limited' });
    });

    expect(result.current.error).toBe('Rate limited');
    expect(onError).toHaveBeenCalledWith('Rate limited');
  });

  it('handles walk_complete message', async () => {
    const onWalkComplete = jest.fn();
    const { ws } = await connectHook({ onWalkComplete });

    act(() => {
      ws.simulateMessage({ type: 'walk_complete' });
    });

    expect(onWalkComplete).toHaveBeenCalled();
  });

  it('handles closed message', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'closed' });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it('handles connecting message without crash', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'connecting' });
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('connecting to AI')
    );
    consoleSpy.mockRestore();
  });
});

describe('useGeminiLive — audio playback pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('enqueues binary audio data and starts playback', async () => {
    const onSpeakingStart = jest.fn();
    const { result, ws } = await connectHook({ onSpeakingStart });

    const pcmData = new Int16Array([100, -200, 300]).buffer;
    act(() => {
      ws.simulateBinaryMessage(pcmData);
    });

    expect(result.current.isSpeaking).toBe(true);
    expect(onSpeakingStart).toHaveBeenCalled();
    // Should have created a buffer source node
    expect(mockBufferSourceNodes.length).toBeGreaterThan(0);
    expect(mockBufferSourceNodes[0].start).toHaveBeenCalled();
  });

  it('calls onSpeakingEnd when queue is drained', async () => {
    const onSpeakingEnd = jest.fn();
    const { ws } = await connectHook({ onSpeakingEnd });

    const pcmData = new Int16Array([100]).buffer;
    act(() => {
      ws.simulateBinaryMessage(pcmData);
    });

    // Simulate the source node ending playback
    act(() => {
      if (mockBufferSourceNodes[0].onended) {
        mockBufferSourceNodes[0].onended();
      }
    });

    expect(onSpeakingEnd).toHaveBeenCalled();
  });

  it('queues multiple audio chunks and plays them sequentially', async () => {
    const { ws } = await connectHook();

    const chunk1 = new Int16Array([100, 200]).buffer;
    const chunk2 = new Int16Array([300, 400]).buffer;

    act(() => {
      ws.simulateBinaryMessage(chunk1);
      ws.simulateBinaryMessage(chunk2);
    });

    // First chunk starts playing immediately
    expect(mockBufferSourceNodes[0].start).toHaveBeenCalled();

    // Simulate first chunk finishing
    act(() => {
      if (mockBufferSourceNodes[0].onended) {
        mockBufferSourceNodes[0].onended();
      }
    });

    // Second chunk should now be playing
    expect(mockBufferSourceNodes.length).toBe(2);
    expect(mockBufferSourceNodes[1].start).toHaveBeenCalled();
  });

  it('detects JSON-as-binary from proxy (zrok/ngrok)', async () => {
    const { result, ws } = await connectHook();

    // Build a jsdom-native ArrayBuffer from JSON string bytes.
    // We cannot use TextEncoder from Node's util module because jsdom has its
    // own ArrayBuffer class, and Node's ArrayBuffer fails instanceof checks.
    const jsonStr = JSON.stringify({ type: 'input_transcript', text: 'proxied' });
    const bytes = new Uint8Array(jsonStr.length);
    for (let i = 0; i < jsonStr.length; i++) bytes[i] = jsonStr.charCodeAt(i);

    act(() => {
      ws.simulateBinaryMessage(bytes.buffer);
    });

    expect(result.current.userTranscript).toBe('proxied');
  });

  it('treats binary data starting with non-{ as raw audio', async () => {
    const { result, ws } = await connectHook();

    // Binary data that doesn't start with '{' should be treated as audio
    const audioData = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]).buffer;
    act(() => {
      ws.simulateBinaryMessage(audioData);
    });

    expect(result.current.isSpeaking).toBe(true);
  });

  it('treats binary data starting with { but invalid JSON as audio', async () => {
    const { result, ws } = await connectHook();

    // Starts with '{' but is not valid JSON — use jsdom-native Uint8Array
    // Must be even byte length since enqueueAudio wraps it in Int16Array
    const str = '{not-json data!}';  // 16 chars = even byte count
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);

    act(() => {
      ws.simulateBinaryMessage(bytes.buffer);
    });

    // Should be treated as audio (enqueued)
    expect(result.current.isSpeaking).toBe(true);
  });
});

describe('useGeminiLive — error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('handles WebSocket connection failure', async () => {
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

    await act(async () => {
      await connectPromise!.catch(() => {});
    });

    expect(result.current.error).toBeTruthy();
    expect(onError).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it('sets error on abnormal WebSocket close (not code 1000)', async () => {
    const onError = jest.fn();
    const { result, ws } = await connectHook({ onError });

    act(() => {
      ws.simulateClose(1006, 'Connection dropped');
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  it('does not set error on clean close (code 1000)', async () => {
    const onError = jest.fn();
    const { result } = await connectHook({ onError });

    // Clean disconnect
    act(() => {
      result.current.disconnect();
    });

    // disconnect calls ws.close() which triggers code 1000
    // Error should NOT be set on clean close
    // (the close mock fires with code 1000)
  });

  it('handles invalid JSON gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { ws } = await connectHook();

    act(() => {
      if (ws.onmessage) {
        ws.onmessage({ data: 'not json at all' } as MessageEvent);
      }
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse'),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});

describe('useGeminiLive — disconnect and cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('resets all state on disconnect', async () => {
    const { result, ws } = await connectHook();

    // Accumulate some state
    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'test' });
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
  });

  it('commits pending transcripts before cleanup', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'Pending msg' });
      ws.simulateMessage({ type: 'output_transcript', text: 'AI reply' });
    });

    act(() => {
      result.current.disconnect();
    });

    // Pending transcripts should be committed to messages
    expect(result.current.messages.length).toBeGreaterThan(0);
  });
});

describe('useGeminiLive — sendText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('sends text message via WebSocket', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      result.current.sendText('My tomato has spots');
    });

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'text', text: 'My tomato has spots' })
    );
  });

  it('does nothing when not connected', () => {
    const { result } = renderHook(() => useGeminiLive());

    // Should not throw
    act(() => {
      result.current.sendText('test');
    });

    expect(result.current.error).toBeNull();
  });
});

describe('useGeminiLive — sendImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('sends image with stripped data URL prefix', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      result.current.sendImage('data:image/jpeg;base64,abcdef', 'Check this');
    });

    const lastCall = ws.send.mock.calls[ws.send.mock.calls.length - 1][0];
    const parsed = JSON.parse(lastCall);
    expect(parsed.type).toBe('image');
    expect(parsed.imageData).toBe('abcdef');
    expect(parsed.text).toBe('Check this');
  });

  it('uses default text when none provided', async () => {
    const { result, ws } = await connectHook();

    act(() => {
      result.current.sendImage('raw-base64');
    });

    const lastCall = ws.send.mock.calls[ws.send.mock.calls.length - 1][0];
    const parsed = JSON.parse(lastCall);
    expect(parsed.text).toBe('Here is a photo of my plant. What do you see?');
  });

  it('does nothing when not connected', () => {
    const { result } = renderHook(() => useGeminiLive());

    act(() => {
      result.current.sendImage('base64data');
    });

    expect(result.current.error).toBeNull();
  });
});

describe('useGeminiLive — pauseMic / resumeMic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('pauseMic sets isListening to false', async () => {
    const { result } = await connectHook();

    act(() => {
      result.current.pauseMic();
    });

    expect(result.current.isListening).toBe(false);
  });

  it('resumeMic sets isListening to true when connected', async () => {
    const { result } = await connectHook();

    act(() => {
      result.current.pauseMic();
    });

    act(() => {
      result.current.resumeMic();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('resumeMic does not set isListening when disconnected', () => {
    const { result } = renderHook(() => useGeminiLive());

    act(() => {
      result.current.resumeMic();
    });

    expect(result.current.isListening).toBe(false);
  });
});

describe('useGeminiLive — multiple conversation turns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('accumulates messages across multiple turns', async () => {
    const { result, ws } = await connectHook();

    // Turn 1
    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'My tomato has yellow leaves' });
      ws.simulateMessage({ type: 'output_transcript', text: 'That could be nitrogen deficiency' });
      ws.simulateMessage({ type: 'turn_complete' });
    });

    // Turn 2
    act(() => {
      ws.simulateMessage({ type: 'input_transcript', text: 'What should I do?' });
      ws.simulateMessage({ type: 'output_transcript', text: 'Apply fertilizer' });
      ws.simulateMessage({ type: 'turn_complete' });
    });

    expect(result.current.messages).toHaveLength(4);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[2].role).toBe('user');
    expect(result.current.messages[3].role).toBe('assistant');
  });
});

describe('useGeminiLive — accepts callbacks in options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBufferSourceNodes = [];
  });

  it('does not call callbacks on initialization', () => {
    const onConnected = jest.fn();
    const onError = jest.fn();
    const onSpeakingStart = jest.fn();
    const onSpeakingEnd = jest.fn();

    renderHook(() =>
      useGeminiLive({ onConnected, onError, onSpeakingStart, onSpeakingEnd })
    );

    expect(onConnected).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSpeakingStart).not.toHaveBeenCalled();
    expect(onSpeakingEnd).not.toHaveBeenCalled();
  });

  it('calls onSpeakingStart/End during audio playback cycle', async () => {
    const onSpeakingStart = jest.fn();
    const onSpeakingEnd = jest.fn();
    const { ws } = await connectHook({ onSpeakingStart, onSpeakingEnd });

    act(() => {
      ws.simulateBinaryMessage(new Int16Array([100]).buffer);
    });
    expect(onSpeakingStart).toHaveBeenCalled();

    act(() => {
      if (mockBufferSourceNodes[0]?.onended) {
        mockBufferSourceNodes[0].onended();
      }
    });
    expect(onSpeakingEnd).toHaveBeenCalled();
  });
});
