import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IPhoneMessagePreviewProps {
  senderId: string;
  message: string;
  recipientCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function IPhoneMessagePreview({
  senderId,
  message,
  recipientCount,
  onConfirm,
  onCancel,
  isLoading = false,
}: IPhoneMessagePreviewProps) {
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="relative w-full max-w-[320px] my-auto">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute -top-10 right-0 text-white/80 hover:text-white p-2 touch-manipulation"
          aria-label="Close preview"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Phone Frame - Simplified for mobile */}
        <div className="bg-black rounded-[2rem] p-2 shadow-xl">
          {/* Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
          
          {/* Screen */}
          <div className="bg-gray-100 rounded-[1.75rem] overflow-hidden">
            {/* Status Bar */}
            <div className="flex items-center justify-between px-6 pt-3 pb-1 text-black text-xs">
              <span className="font-semibold">{currentTime}</span>
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  <div className="w-1 h-2 bg-black rounded-sm" />
                  <div className="w-1 h-2.5 bg-black rounded-sm" />
                  <div className="w-1 h-3 bg-black rounded-sm" />
                  <div className="w-1 h-3.5 bg-black rounded-sm" />
                </div>
                <div className="w-4 h-2 bg-black rounded-sm ml-1" />
              </div>
            </div>

            {/* Messages Header */}
            <div className="bg-gray-100 border-b border-gray-300 px-4 py-2">
              <div className="text-center">
                <div className="w-8 h-8 bg-gray-400 rounded-full mx-auto mb-1 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {senderId.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-semibold text-black">
                  {senderId || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Message Content */}
            <div className="min-h-[180px] max-h-[240px] p-3 bg-gray-50 overflow-y-auto">
              {/* Today indicator */}
              <div className="text-center mb-3">
                <span className="text-[10px] text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded-full">
                  Today {currentTime}
                </span>
              </div>

              {/* Message Bubble */}
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-[#E9E9EB] rounded-2xl rounded-tl-md px-3 py-2">
                  <p className="text-black text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message || 'Your message will appear here...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery info */}
            <div className="bg-gray-100 border-t border-gray-200 px-4 py-3 text-center">
              <p className="text-xs text-gray-600">
                Sending to <span className="font-semibold">{recipientCount}</span> recipient{recipientCount !== 1 ? 's' : ''}
              </p>
              {senderId && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  From: {senderId}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom on mobile */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 h-11 text-sm touch-manipulation"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="hero"
            className="flex-1 h-11 text-sm touch-manipulation"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : `Send (${recipientCount})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
