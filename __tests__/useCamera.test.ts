import { renderHook, act, waitFor } from '@testing-library/react';
import { useCamera } from '@/hooks/useCamera';

describe('useCamera', () => {
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;

  beforeEach(() => {
    mockTrack = {
      stop: jest.fn(),
      readyState: 'live',
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
    } as unknown as MediaStream;

    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream),
    } as unknown as MediaDevices;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial state correctly', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.isActive).toBe(false);
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeNull();
    expect(typeof result.current.startCamera).toBe('function');
    expect(typeof result.current.stopCamera).toBe('function');
    expect(typeof result.current.capturePhoto).toBe('function');
  });

  it('should request back camera with environment facingMode', async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    });
  });

  it('should set stream and isActive when camera starts', async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.stream).toBe(mockStream);
    expect(result.current.error).toBeNull();
  });

  it('should stop all tracks and cleanup on stopCamera', async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    act(() => {
      result.current.stopCamera();
    });

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
    expect(result.current.stream).toBeNull();
  });

  it('should cleanup stream on unmount', async () => {
    const { result, unmount } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    unmount();

    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('should handle permission denied error', async () => {
    const permissionError = new DOMException('Permission denied', 'NotAllowedError');
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(permissionError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toBe('Camera permission denied. Please allow camera access.');
    expect(result.current.isActive).toBe(false);
    expect(result.current.stream).toBeNull();
  });

  it('should handle camera not found error', async () => {
    const notFoundError = new DOMException('No camera', 'NotFoundError');
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(notFoundError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toBe('No camera found on this device.');
    expect(result.current.isActive).toBe(false);
  });

  it('should handle generic camera errors', async () => {
    const genericError = new Error('Something went wrong');
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(genericError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toBe('Failed to access camera: Something went wrong');
    expect(result.current.isActive).toBe(false);
  });

  describe('capturePhoto', () => {
    let mockVideo: HTMLVideoElement;
    let mockContext: CanvasRenderingContext2D;
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
      mockVideo = {
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;

      mockContext = {
        drawImage: jest.fn(),
      } as unknown as CanvasRenderingContext2D;

      // Store original createElement
      originalCreateElement = document.createElement.bind(document);
    });

    afterEach(() => {
      // Restore original createElement
      document.createElement = originalCreateElement;
    });

    it('should capture photo and return base64 JPEG', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      // Now mock createElement after renderHook completes
      const mockCanvas = {
        getContext: jest.fn().mockReturnValue(mockContext),
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,mockImageData'),
        width: 0,
        height: 0,
      };

      document.createElement = jest.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      let photoData: string | null = null;
      await act(async () => {
        photoData = await result.current.capturePhoto(mockVideo);
      });

      expect(photoData).toBe('data:image/jpeg;base64,mockImageData');
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    });

    it('should draw video frame to canvas at correct dimensions', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      const mockCanvas = {
        getContext: jest.fn().mockReturnValue(mockContext),
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,mockImageData'),
        width: 0,
        height: 0,
      };

      document.createElement = jest.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      await act(async () => {
        await result.current.capturePhoto(mockVideo);
      });

      expect(mockCanvas.width).toBe(640);
      expect(mockCanvas.height).toBe(480);
      expect(mockContext.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0);
    });

    it('should return null if camera is not active', async () => {
      const { result } = renderHook(() => useCamera());

      let photoData: string | null = null;
      await act(async () => {
        photoData = await result.current.capturePhoto(mockVideo);
      });

      expect(photoData).toBeNull();
    });

    it('should return null if video element is invalid', async () => {
      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      const invalidVideo = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;

      let photoData: string | null = null;
      await act(async () => {
        photoData = await result.current.capturePhoto(invalidVideo);
      });

      expect(photoData).toBeNull();
    });
  });
});
