import React, { useRef, useEffect } from 'react';

interface PhotoLibraryProps {
  onSelect: (imageData: string) => void;
  onCancel: () => void;
}

const PhotoLibrary: React.FC<PhotoLibraryProps> = ({ onSelect, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-trigger file picker on mount
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      onCancel();
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      onCancel();
      return;
    }

    // Convert to base64
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      onSelect(base64);
    };

    reader.onerror = () => {
      alert('Error reading file');
      onCancel();
    };

    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div
        style={{
          color: '#fff',
          fontSize: '18px',
          padding: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '8px',
        }}
      >
        Selecting photo...
      </div>
    </div>
  );
};

export default PhotoLibrary;
