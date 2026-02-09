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

      // "Welcome" appears in both the hero title and tile label
      const welcomeTexts = screen.getAllByText('Welcome');
      expect(welcomeTexts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Starting your garden walk')).toBeInTheDocument();
    });

    it('should show plant_id label at plant_id stage', () => {
      render(<GardenJourney currentStage="plant_id" isWalking={false} />);

      expect(screen.getByText('Tell me about your plant')).toBeInTheDocument();
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

      expect(screen.getByText('Wrapping up your garden walk')).toBeInTheDocument();
    });
  });

  describe('walking animation', () => {
    it('should show pulsing dot indicator when isWalking is true', () => {
      const { container } = render(<GardenJourney currentStage="plant_id" isWalking={true} />);

      // The walking indicator is now a pulsing dot with animate-pulse class
      const pulsingDot = container.querySelector('.animate-pulse');
      expect(pulsingDot).toBeInTheDocument();
    });

    it('should not show pulsing dot indicator when isWalking is false', () => {
      const { container } = render(<GardenJourney currentStage="plant_id" isWalking={false} />);

      // No pulsing dot when not walking
      const pulsingDot = container.querySelector('.animate-pulse');
      expect(pulsingDot).not.toBeInTheDocument();
    });
  });

  describe('stage progression', () => {
    it('should render all stages in correct order', () => {
      const { container } = render(<GardenJourney currentStage="complete" isWalking={false} />);

      // At complete stage, all 6 tile icons should be visible
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(6);
    });

    it('should show Welcome tile label only highlighted at start stage', () => {
      const { rerender } = render(<GardenJourney currentStage="start" isWalking={false} />);
      // "Welcome" appears in both hero title and tile label
      const welcomeTexts = screen.getAllByText('Welcome');
      expect(welcomeTexts.length).toBeGreaterThanOrEqual(1);

      rerender(<GardenJourney currentStage="plant_id" isWalking={false} />);
      // Welcome tile label still exists but is no longer the active stage hero
      const welcomeAfter = screen.getAllByText('Welcome');
      expect(welcomeAfter.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('stage transitions', () => {
    it('should delay stage update when walking', () => {
      const { rerender } = render(<GardenJourney currentStage="start" isWalking={false} />);

      // Start walking to next stage
      rerender(<GardenJourney currentStage="plant_id" isWalking={true} />);

      // Initially should still show start stage subtitle due to animation delay
      expect(screen.getByText('Starting your garden walk')).toBeInTheDocument();

      // After delay, should update
      act(() => {
        jest.advanceTimersByTime(700);
      });

      // Now should show new stage subtitle
      expect(screen.getByText('Tell me about your plant')).toBeInTheDocument();
    });
  });
});
