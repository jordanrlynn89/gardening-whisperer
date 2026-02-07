import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CameraCapture } from '@/components/CameraCapture';

// Mock the useCamera hook
const mockStartCamera = jest.fn();
const mockStopCamera = jest.fn();
const mockCapturePhoto = jest.fn();

jest.mock('@/hooks/useCamera', () => ({
  useCamera: () => ({
    isActive: mockIsActive,
    stream: mockStream,
    error: mockError,
    startCamera: mockStartCamera,
    stopCamera: mockStopCamera,
    capturePhoto: mockCapturePhoto,
  }),
}));

let mockIsActive = false;
let mockStream: MediaStream | null = null;
let mockError: string | null = null;

describe('CameraCapture', () => {
  const mockOnCapture = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockIsActive = false;
    mockStream = null;
    mockError = null;
    mockStartCamera.mockClear();
    mockStopCamera.mockClear();
    mockCapturePhoto.mockClear();
    mockOnCapture.mockClear();
    mockOnCancel.mockClear();
  });

  it('should render modal overlay', () => {
    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should display header with title', () => {
    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    expect(screen.getByText('Frame your plant')).toBeInTheDocument();
  });

  it('should show loading state while camera initializes', () => {
    mockIsActive = false;
    mockStream = null;

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    expect(screen.getByText('Activating camera...')).toBeInTheDocument();
  });

  it('should call startCamera on mount', () => {
    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    expect(mockStartCamera).toHaveBeenCalled();
  });

  it('should call stopCamera on unmount', () => {
    const { unmount } = render(
      <CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />
    );

    unmount();

    expect(mockStopCamera).toHaveBeenCalled();
  });

  it('should show capture and cancel buttons when camera is active', () => {
    mockIsActive = true;
    mockStream = {} as MediaStream;

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    expect(screen.getByRole('button', { name: /capture/i })).toBeInTheDocument();
    // There are two cancel buttons (header + controls), verify at least one exists
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
  });

  it('should call onCancel when cancel button is clicked', () => {
    mockIsActive = true;
    mockStream = {} as MediaStream;

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    // Click the first cancel button (header)
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should display error state when camera fails', () => {
    mockError = 'Camera permission denied. Please allow camera access.';

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    expect(screen.getByText(/Camera permission denied/i)).toBeInTheDocument();
  });

  it('should show Go Back button in error state', () => {
    mockError = 'Camera permission denied. Please allow camera access.';

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    const goBackButton = screen.getByRole('button', { name: /go back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call capturePhoto and onCapture when capture button is clicked', async () => {
    mockIsActive = true;
    mockStream = {} as MediaStream;
    mockCapturePhoto.mockResolvedValue('data:image/jpeg;base64,testImageData');

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /capture/i }));

    // Component enters review mode after capture
    await waitFor(() => {
      expect(mockCapturePhoto).toHaveBeenCalled();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    // Click "Analyze" to confirm and trigger onCapture
    fireEvent.click(screen.getByRole('button', { name: /confirm and analyze/i }));

    expect(mockOnCapture).toHaveBeenCalledWith('data:image/jpeg;base64,testImageData');
  });

  it('should have video element with playsInline for iOS', () => {
    mockIsActive = true;
    mockStream = {} as MediaStream;

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    const video = document.querySelector('video');
    expect(video).toHaveAttribute('playsinline');
  });

  it('should have autoPlay on video element', () => {
    mockIsActive = true;
    mockStream = {} as MediaStream;

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    const video = document.querySelector('video');
    expect(video).toHaveAttribute('autoplay');
  });

  it('should have capture button with minimum touch target size', () => {
    mockIsActive = true;
    mockStream = {} as MediaStream;

    render(<CameraCapture onCapture={mockOnCapture} onCancel={mockOnCancel} />);

    const captureButton = screen.getByRole('button', { name: /capture/i });
    // Check for w-24 h-24 classes (96px)
    expect(captureButton.className).toMatch(/w-24/);
    expect(captureButton.className).toMatch(/h-24/);
  });
});
