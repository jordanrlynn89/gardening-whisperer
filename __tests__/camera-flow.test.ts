/**
 * Camera Flow Tests
 *
 * Tests the useCamera hook: permission flow, photo capture with base64 encoding,
 * photo review (accept/retake) flow, and error states.
 */

import { renderHook, act } from '@testing-library/react';
import { useCamera } from '../hooks/useCamera';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Track all created media streams so we can verify cleanup
let mockTracks: { stop: jest.Mock }[];
let mockStream: {
  getTracks: jest.Mock;
};

function createMockStream() {
  mockTracks = [{ stop: jest.fn() }, { stop: jest.fn() }];
  mockStream = {
    getTracks: jest.fn(() => mockTracks),
  };
  return mockStream;
}

// Mock getUserMedia
const mockGetUserMedia = jest.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
  configurable: true,
});

// Mock canvas/context for capturePhoto
const mockDrawImage = jest.fn();
const mockToDataURL = jest.fn(() => 'data:image/jpeg;base64,mockbase64data');
const mockGetContext = jest.fn<{ drawImage: jest.Mock } | null, [string]>(() => ({
  drawImage: mockDrawImage,
}));

// Mock document.createElement for canvas
const originalCreateElement = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    return {
      width: 0,
      height: 0,
      getContext: mockGetContext,
      toDataURL: mockToDataURL,
    } as unknown as HTMLCanvasElement;
  }
  return originalCreateElement(tagName);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useCamera — initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts inactive with no stream or error', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.isActive).toBe(false);
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('exposes startCamera, stopCamera, and capturePhoto functions', () => {
    const { result } = renderHook(() => useCamera());

    expect(typeof result.current.startCamera).toBe('function');
    expect(typeof result.current.stopCamera).toBe('function');
    expect(typeof result.current.capturePhoto).toBe('function');
  });
});

describe('useCamera — permission request flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests camera with environment facing mode preference', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  });

  it('transitions to active state on success', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.stream).toBe(stream);
    expect(result.current.error).toBeNull();
  });

  it('sets error on NotAllowedError (permission denied)', async () => {
    const permError = new DOMException('Permission denied', 'NotAllowedError');
    mockGetUserMedia.mockRejectedValueOnce(permError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toContain('permission denied');
  });

  it('sets error on NotFoundError (no camera)', async () => {
    const notFoundError = new DOMException('No camera', 'NotFoundError');
    mockGetUserMedia.mockRejectedValueOnce(notFoundError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toContain('No camera');
  });

  it('sets generic error on unknown camera failure', async () => {
    const genericError = new Error('Something unexpected');
    mockGetUserMedia.mockRejectedValueOnce(genericError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toContain('Failed to access camera');
  });

  it('clears previous error on new start attempt', async () => {
    // First attempt fails
    mockGetUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.error).toBeTruthy();

    // Second attempt succeeds
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isActive).toBe(true);
  });
});

describe('useCamera — photo capture and base64 encoding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('captures photo and returns base64 data URL', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
    } as HTMLVideoElement;

    let imageData: string | null = null;
    await act(async () => {
      imageData = await result.current.capturePhoto(mockVideo);
    });

    expect(imageData).toBe('data:image/jpeg;base64,mockbase64data');
    expect(mockDrawImage).toHaveBeenCalledWith(mockVideo, 0, 0);
  });

  it('returns null when camera is not active', async () => {
    const { result } = renderHook(() => useCamera());

    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
    } as HTMLVideoElement;

    let imageData: string | null = 'not-null';
    await act(async () => {
      imageData = await result.current.capturePhoto(mockVideo);
    });

    expect(imageData).toBeNull();
  });

  it('returns null when video dimensions are zero', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    const mockVideo = {
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement;

    let imageData: string | null = 'not-null';
    await act(async () => {
      imageData = await result.current.capturePhoto(mockVideo);
    });

    expect(imageData).toBeNull();
  });

  it('returns null when canvas context is unavailable', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);
    mockGetContext.mockReturnValueOnce(null);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
    } as HTMLVideoElement;

    let imageData: string | null = 'not-null';
    await act(async () => {
      imageData = await result.current.capturePhoto(mockVideo);
    });

    expect(imageData).toBeNull();
  });
});

describe('useCamera — stop and cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stops all tracks when stopCamera is called', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    act(() => {
      result.current.stopCamera();
    });

    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockTracks[1].stop).toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
    expect(result.current.stream).toBeNull();
  });

  it('cleans up media tracks on unmount', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result, unmount } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    unmount();

    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockTracks[1].stop).toHaveBeenCalled();
  });

  it('handles stopCamera when no stream is active', () => {
    const { result } = renderHook(() => useCamera());

    // Should not throw
    act(() => {
      result.current.stopCamera();
    });

    expect(result.current.isActive).toBe(false);
  });
});

describe('useCamera — retake flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('can capture multiple photos in sequence (retake pattern)', async () => {
    const stream = createMockStream();
    mockGetUserMedia.mockResolvedValueOnce(stream);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    const mockVideo = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;

    // First capture
    let photo1: string | null = null;
    await act(async () => {
      photo1 = await result.current.capturePhoto(mockVideo);
    });
    expect(photo1).toBeTruthy();

    // Second capture (retake) - camera is still active
    let photo2: string | null = null;
    await act(async () => {
      photo2 = await result.current.capturePhoto(mockVideo);
    });
    expect(photo2).toBeTruthy();
    expect(result.current.isActive).toBe(true);
  });
});
