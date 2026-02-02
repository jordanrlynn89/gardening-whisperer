import React from 'react';

interface PhotoChooserProps {
  onCameraSelect: () => void;
  onLibrarySelect: () => void;
  onCancel: () => void;
}

const PhotoChooser: React.FC<PhotoChooserProps> = ({
  onCameraSelect,
  onLibrarySelect,
  onCancel,
}) => {
  return (
    <div
      data-testid="photo-chooser-backdrop"
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        data-testid="photo-chooser-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#2d2d2d',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          position: 'relative',
        }}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: '1',
          }}
        >
          ×
        </button>

        <h2
          style={{
            color: '#fff',
            fontSize: '20px',
            marginBottom: '24px',
            marginTop: '0',
            fontWeight: '500',
          }}
        >
          Add a Photo
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <button
            onClick={onCameraSelect}
            style={{
              backgroundColor: '#4a7c59',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#5a8c69';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#4a7c59';
            }}
          >
            Take a Picture
          </button>

          <button
            onClick={onLibrarySelect}
            style={{
              backgroundColor: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#555';
            }}
          >
            Select from Library
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoChooser;
