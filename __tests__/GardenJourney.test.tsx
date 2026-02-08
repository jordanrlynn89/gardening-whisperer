import { render, screen, act } from '@testing-library/react';
import { GardenJourney, JourneyStage } from '@/components/GardenJourney';

describe('GardenJourney', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('stage rendering', () => {
    it('should show archway at start stage', () => {
      render(<GardenJourney currentStage="start" isWalking={false} />);

      expect(screen.getByText('Welcome to the Garden')).toBeInTheDocument();
      expect(screen.getByText('Enter')).toBeInTheDocument();
    });

    it('should show plant_id label at plant_id stage', () => {
      render(<GardenJourney currentStage="plant_id" isWalking={false} />);

      expect(screen.getByText('What plant do you have?')).toBeInTheDocument();
    });

    it('should show symptoms label at symptoms stage', () => {
      render(<GardenJourney currentStage="symptoms" isWalking={false} />);

      expect(screen.getByText('What symptoms do you see?')).toBeInTheDocument();
    });

    it('should show environment label at environment stage', () => {
      render(<GardenJourney currentStage="environment" isWalking={false} />);

      expect(screen.getByText('Tell me about its environment')).toBeInTheDocument();
    });

    it('should show care_history label at care_history stage', () => {
      render(<GardenJourney currentStage="care_history" isWalking={false} />);

      expect(screen.getByText('How have you been caring for it?')).toBeInTheDocument();
    });

    it('should show diagnosis label at complete stage', () => {
      render(<GardenJourney currentStage="complete" isWalking={false} />);

      expect(screen.getByText('Diagnosis Ready')).toBeInTheDocument();
    });
  });

  describe('walking animation', () => {
    it('should show walking indicator when isWalking is true', () => {
      render(<GardenJourney currentStage="plant_id" isWalking={true} />);

      expect(screen.getByText('Walking...')).toBeInTheDocument();
    });

    it('should not show walking indicator when isWalking is false', () => {
      render(<GardenJourney currentStage="plant_id" isWalking={false} />);

      expect(screen.queryByText('Walking...')).not.toBeInTheDocument();
    });
  });

  describe('stage progression', () => {
    it('should render all stages in correct order', () => {
      const { container } = render(<GardenJourney currentStage="complete" isWalking={false} />);

      // At complete stage, all icons should be visible (opacity-100)
      const svgs = container.querySelectorAll('svg');
      // 8 svgs: 6 stage icons + 2 decorative vine paths
      expect(svgs.length).toBe(8);
    });

    it('should show Enter text only at start stage', () => {
      const { rerender } = render(<GardenJourney currentStage="start" isWalking={false} />);
      expect(screen.getByText('Enter')).toBeInTheDocument();

      rerender(<GardenJourney currentStage="plant_id" isWalking={false} />);
      expect(screen.queryByText('Enter')).not.toBeInTheDocument();
    });
  });

  describe('stage transitions', () => {
    it('should delay stage update when walking', () => {
      const { rerender } = render(<GardenJourney currentStage="start" isWalking={false} />);

      // Start walking to next stage
      rerender(<GardenJourney currentStage="plant_id" isWalking={true} />);

      // Initially should still show start label due to animation delay
      expect(screen.getByText('Welcome to the Garden')).toBeInTheDocument();

      // After delay, should update
      act(() => {
        jest.advanceTimersByTime(700);
      });

      // Now should show new stage
      expect(screen.getByText('What plant do you have?')).toBeInTheDocument();
    });
  });
});
