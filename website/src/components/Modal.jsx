import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true 
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-surface-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      <div 
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-elevated animate-scale-in`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            {title && (
              <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
