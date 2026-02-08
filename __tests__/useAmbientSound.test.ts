import { renderHook, act } from '@testing-library/react';
import { useAmbientSound } from '@/hooks/useAmbientSound';

describe('useAmbientSound', () => {
  let mockAudioInstances: Array<{
    play: jest.Mock;
    pause: jest.Mock;
    volume: number;
    loop: boolean;
    currentTime: number;
    onerror: (() => void) | null;
  }>;

  beforeEach(() => {
    mockAudioInstances = [];

    global.Audio = jest.fn().mockImplementation(() => {
      const instance = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        volume: 1,
        loop: false,
        currentTime: 0,
        onerror: null,
      };
      mockAudioInstances.push(instance);
      return instance;
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should return all expected functions', () => {
    const { result } = renderHook(() => useAmbientSound());

    expect(result.current.startAmbient).toBeDefined();
    expect(result.current.stopAmbient).toBeDefined();
    expect(result.current.duck).toBeDefined();
    expect(result.current.unduck).toBeDefined();
  });

  it('should create Audio on mount for preloading', () => {
    renderHook(() => useAmbientSound());

    expect(global.Audio).toHaveBeenCalledTimes(1);
    expect(global.Audio).toHaveBeenCalledWith('/sounds/birds-loop.mp3');
    expect(mockAudioInstances[0].loop).toBe(true);
  });

  it('should start playing when startAmbient is called', () => {
    const { result } = renderHook(() => useAmbientSound());

    act(() => {
      result.current.startAmbient();
    });

    expect(mockAudioInstances[0].play).toHaveBeenCalled();
  });

  it('should duck volume when duck is called', () => {
    const { result } = renderHook(() =>
      useAmbientSound({ volume: 0.15, duckingVolume: 0.05 })
    );

    // Must start first to create the Audio element
    act(() => {
      result.current.startAmbient();
    });

    act(() => {
      result.current.duck();
    });

    expect(mockAudioInstances[0].volume).toBe(0.05);
  });

  it('should restore volume when unduck is called', () => {
    const { result } = renderHook(() =>
      useAmbientSound({ volume: 0.15, duckingVolume: 0.05 })
    );

    // Must start first to create the Audio element
    act(() => {
      result.current.startAmbient();
    });

    act(() => {
      result.current.duck();
    });

    act(() => {
      result.current.unduck();
    });

    expect(mockAudioInstances[0].volume).toBe(0.15);
  });

  it('should not start twice if already playing', () => {
    const { result } = renderHook(() => useAmbientSound());

    act(() => {
      result.current.startAmbient();
    });

    const playCallCount = mockAudioInstances[0].play.mock.calls.length;

    act(() => {
      result.current.startAmbient();
    });

    expect(mockAudioInstances[0].play.mock.calls.length).toBe(playCallCount);
  });

  it('should clear fade interval on unmount', () => {
    const { result, unmount } = renderHook(() => useAmbientSound());

    act(() => {
      result.current.startAmbient();
    });

    // Fade-in interval is running; unmount should clean it up
    unmount();

    // No assertions needed -- if the interval leaks, Jest will complain about
    // open handles. The unmount itself succeeding is the test.
  });

  // ── New tests for improved branch coverage ──

  describe('fade-in transition', () => {
    it('should start volume at 0 and fade in gradually', () => {
      const { result } = renderHook(() => useAmbientSound({ volume: 0.15 }));

      act(() => {
        result.current.startAmbient();
      });

      // Volume should start at 0 for fade-in
      expect(mockAudioInstances[0].volume).toBe(0);

      // Advance one fade-in tick (50ms interval, +0.01 per tick)
      act(() => {
        jest.advanceTimersByTime(50);
      });
      expect(mockAudioInstances[0].volume).toBeCloseTo(0.01, 2);

      // Advance several more ticks
      act(() => {
        jest.advanceTimersByTime(250); // 5 more ticks = 0.06 total
      });
      expect(mockAudioInstances[0].volume).toBeCloseTo(0.06, 2);
    });

    it('should cap volume at the target level', () => {
      const { result } = renderHook(() => useAmbientSound({ volume: 0.05 }));

      act(() => {
        result.current.startAmbient();
      });

      // Advance enough for full fade-in (0.05 / 0.01 = 5 ticks * 50ms = 250ms)
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockAudioInstances[0].volume).toBe(0.05);
    });
  });

  describe('fade-out transition', () => {
    it('should fade out and pause audio on stopAmbient', () => {
      const { result } = renderHook(() => useAmbientSound({ volume: 0.15 }));

      // Start playing
      act(() => {
        result.current.startAmbient();
      });
      // Skip fade-in
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.stopAmbient();
      });

      // Volume should start decreasing from current level
      act(() => {
        jest.advanceTimersByTime(30); // One fade-out tick
      });

      // After enough time, audio should be paused
      act(() => {
        jest.advanceTimersByTime(2000); // plenty of time for full fade
      });

      expect(mockAudioInstances[0].pause).toHaveBeenCalled();
      expect(mockAudioInstances[0].currentTime).toBe(0);
    });

    it('should handle stopAmbient when no audio is initialized', () => {
      const { result } = renderHook(() => useAmbientSound());

      // Don't call startAmbient; no audio exists
      // Should not throw
      act(() => {
        result.current.stopAmbient();
      });
    });
  });

  describe('ducking behavior during speech', () => {
    it('should reduce volume to ducking level during AI speech', () => {
      const { result } = renderHook(() =>
        useAmbientSound({ volume: 0.15, duckingVolume: 0.04 })
      );

      act(() => {
        result.current.startAmbient();
      });
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Duck (AI starts speaking)
      act(() => {
        result.current.duck();
      });
      expect(mockAudioInstances[0].volume).toBe(0.04);

      // Unduck (AI stops speaking)
      act(() => {
        result.current.unduck();
      });
      expect(mockAudioInstances[0].volume).toBe(0.15);
    });

    it('should handle rapid duck/unduck cycles', () => {
      const { result } = renderHook(() =>
        useAmbientSound({ volume: 0.15, duckingVolume: 0.04 })
      );

      act(() => {
        result.current.startAmbient();
        jest.advanceTimersByTime(1000);
      });

      // Rapid duck-unduck
      act(() => {
        result.current.duck();
        result.current.unduck();
        result.current.duck();
        result.current.unduck();
      });

      expect(mockAudioInstances[0].volume).toBe(0.15);
    });

    it('should use default ducking volume of 0.05', () => {
      const { result } = renderHook(() => useAmbientSound());

      act(() => {
        result.current.startAmbient();
      });

      act(() => {
        result.current.duck();
      });

      expect(mockAudioInstances[0].volume).toBe(0.05);
    });

    it('should handle duck/unduck when audio ref is not yet created', () => {
      const { result } = renderHook(() => useAmbientSound());

      // Don't call startAmbient - no audio created yet
      // Should not throw
      act(() => {
        result.current.duck();
        result.current.unduck();
      });
    });
  });

  describe('error handling', () => {
    it('should handle audio play failure silently', () => {
      global.Audio = jest.fn().mockImplementation(() => {
        const instance = {
          play: jest.fn().mockRejectedValue(new Error('Play failed')),
          pause: jest.fn(),
          volume: 1,
          loop: false,
          currentTime: 0,
          onerror: null,
        };
        mockAudioInstances.push(instance);
        return instance;
      });

      const { result } = renderHook(() => useAmbientSound());

      // Should not throw
      act(() => {
        result.current.startAmbient();
      });

      expect(mockAudioInstances[0].play).toHaveBeenCalled();
    });

    it('should not set onerror when using direct audio source', () => {
      const { result } = renderHook(() => useAmbientSound());

      act(() => {
        result.current.startAmbient();
      });

      // No fallback mechanism — onerror is not set
      expect(mockAudioInstances[0].onerror).toBeNull();
    });
  });

  describe('cleanup on unmount', () => {
    it('should pause audio on unmount', () => {
      const { result, unmount } = renderHook(() => useAmbientSound());

      act(() => {
        result.current.startAmbient();
      });

      unmount();

      expect(mockAudioInstances[0].pause).toHaveBeenCalled();
    });

    it('should handle unmount during fade-in', () => {
      const { result, unmount } = renderHook(() => useAmbientSound());

      act(() => {
        result.current.startAmbient();
      });

      // Unmount during fade-in (before it completes)
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should not throw
      unmount();
    });

    it('should handle unmount during fade-out', () => {
      const { result, unmount } = renderHook(() => useAmbientSound());

      act(() => {
        result.current.startAmbient();
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.stopAmbient();
      });

      // Unmount during fade-out
      act(() => {
        jest.advanceTimersByTime(15);
      });

      // Should not throw
      unmount();
    });

    it('should handle unmount when no audio was ever started', () => {
      const { unmount } = renderHook(() => useAmbientSound());

      // Should not throw
      unmount();
    });
  });

  describe('clearFadeInterval behavior', () => {
    it('should clear existing fade-in when startAmbient clears any pending interval', () => {
      const { result } = renderHook(() => useAmbientSound({ volume: 0.15 }));

      // Start playing (creates a fade-in interval)
      act(() => {
        result.current.startAmbient();
      });
      expect(mockAudioInstances[0].play).toHaveBeenCalledTimes(1);

      // Stop first, then start again -- should clear the old interval
      act(() => {
        result.current.stopAmbient();
      });

      // Reset isPlaying so we can start again
      // stopAmbient sets isPlayingRef to false
      act(() => {
        result.current.startAmbient();
      });

      // Advance through second fade-in
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Volume should reach the target level
      expect(mockAudioInstances[0].volume).toBe(0.15);
    });
  });
});
