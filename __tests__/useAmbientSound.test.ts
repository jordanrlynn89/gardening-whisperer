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

  it('should initialize bird sounds on mount', () => {
    renderHook(() => useAmbientSound());

    expect(global.Audio).toHaveBeenCalledTimes(1);
    expect(global.Audio).toHaveBeenCalledWith('/sounds/birds.mp3');
  });

  it('should set correct initial volume', () => {
    renderHook(() => useAmbientSound({ volume: 0.2 }));

    expect(mockAudioInstances[0].volume).toBe(0.2);
    expect(mockAudioInstances[0].loop).toBe(true);
  });

  it('should use default soft volume', () => {
    renderHook(() => useAmbientSound());

    expect(mockAudioInstances[0].volume).toBe(0.15);
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

    act(() => {
      result.current.duck();
    });

    expect(mockAudioInstances[0].volume).toBe(0.05);
  });

  it('should restore volume when unduck is called', () => {
    const { result } = renderHook(() =>
      useAmbientSound({ volume: 0.15, duckingVolume: 0.05 })
    );

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
});
