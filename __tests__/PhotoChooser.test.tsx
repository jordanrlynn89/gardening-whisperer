import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhotoChooser from '../components/PhotoChooser';

describe('PhotoChooser', () => {
  const mockOnCameraSelect = jest.fn();
  const mockOnLibrarySelect = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render both button options', () => {
    render(
      <PhotoChooser
        onCameraSelect={mockOnCameraSelect}
        onLibrarySelect={mockOnLibrarySelect}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Take a Picture')).toBeInTheDocument();
    expect(screen.getByText('Select from Library')).toBeInTheDocument();
  });

  it('should call onCameraSelect when Take a Picture is clicked', () => {
    render(
      <PhotoChooser
        onCameraSelect={mockOnCameraSelect}
        onLibrarySelect={mockOnLibrarySelect}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Take a Picture'));
    expect(mockOnCameraSelect).toHaveBeenCalledTimes(1);
  });

  it('should call onLibrarySelect when Select from Library is clicked', () => {
    render(
      <PhotoChooser
        onCameraSelect={mockOnCameraSelect}
        onLibrarySelect={mockOnLibrarySelect}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Select from Library'));
    expect(mockOnLibrarySelect).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when backdrop is clicked', () => {
    render(
      <PhotoChooser
        onCameraSelect={mockOnCameraSelect}
        onLibrarySelect={mockOnLibrarySelect}
        onCancel={mockOnCancel}
      />
    );

    const backdrop = screen.getByTestId('photo-chooser-backdrop');
    fireEvent.click(backdrop);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when close button is clicked', () => {
    render(
      <PhotoChooser
        onCameraSelect={mockOnCameraSelect}
        onLibrarySelect={mockOnLibrarySelect}
        onCancel={mockOnCancel}
      />
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should not call onCancel when modal content is clicked', () => {
    render(
      <PhotoChooser
        onCameraSelect={mockOnCameraSelect}
        onLibrarySelect={mockOnLibrarySelect}
        onCancel={mockOnCancel}
      />
    );

    const modal = screen.getByTestId('photo-chooser-modal');
    fireEvent.click(modal);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});
