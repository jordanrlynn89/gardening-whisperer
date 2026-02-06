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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <style>{`
        @keyframes modal-slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .modal-entrance {
          animation: modal-slide-up 0.3s ease-out;
        }
      `}</style>
      <div
        data-testid="photo-chooser-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm mx-4 bg-stone-900 rounded-3xl shadow-2xl overflow-hidden modal-entrance"
      >
        {/* Gradient background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-stone-950 pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-300 hover:bg-stone-800/50 transition-all duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="relative p-8 pt-12">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-light text-stone-100 tracking-wide">
              Add a Photo
            </h2>
            <p className="text-sm text-stone-400 font-light mt-2">
              Show your plant to the AI
            </p>
          </div>

          {/* Button container with staggered animation */}
          <style>{`
            @keyframes button-fade-in {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .button-1 { animation: button-fade-in 0.4s ease-out 0.05s both; }
            .button-2 { animation: button-fade-in 0.4s ease-out 0.15s both; }
          `}</style>
          <div className="flex flex-col gap-3">
            {/* Take a Picture button - primary action */}
            <button
              onClick={onCameraSelect}
              className="button-1 group relative w-full px-6 py-4 rounded-full font-semibold text-white transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-stone-900"
            >
              {/* Button background with glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-full group-hover:shadow-lg group-hover:shadow-emerald-500/40 transition-all duration-200" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 blur-lg" />

              {/* Text and icon */}
              <div className="relative flex items-center justify-center gap-3">
                <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Take a Picture</span>
              </div>
            </button>

            {/* Select from Library button - secondary action */}
            <button
              onClick={onLibrarySelect}
              className="button-2 group relative w-full px-6 py-4 rounded-full font-semibold text-stone-200 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-600 focus:ring-offset-2 focus:ring-offset-stone-900"
            >
              {/* Button background */}
              <div className="absolute inset-0 bg-stone-800 rounded-full group-hover:bg-stone-700 transition-colors duration-200" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-stone-700 to-stone-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

              {/* Text and icon */}
              <div className="relative flex items-center justify-center gap-3">
                <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Select from Library</span>
              </div>
            </button>
          </div>

          {/* Divider with subtle accent */}
          <div className="mt-6 pt-6 border-t border-stone-800/50 flex items-center justify-center">
            <p className="text-xs text-stone-500 font-light">Or skip to continue talking</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoChooser;
