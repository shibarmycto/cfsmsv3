import { X, Wifi, Signal, Battery } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative max-w-sm w-full">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-8 h-8" />
        </button>

        {/* iPhone Frame */}
        <div className="bg-black rounded-[3rem] p-3 shadow-2xl">
          {/* Dynamic Island */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-10" />
          
          {/* Screen */}
          <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-[2.5rem] overflow-hidden">
            {/* Status Bar */}
            <div className="flex items-center justify-between px-8 pt-4 pb-2">
              <span className="text-sm font-semibold text-black">{currentTime}</span>
              <div className="flex items-center gap-1">
                <Signal className="w-4 h-4 text-black" />
                <Wifi className="w-4 h-4 text-black" />
                <Battery className="w-5 h-5 text-black" />
              </div>
            </div>

            {/* Messages Header */}
            <div className="bg-gray-100/80 backdrop-blur-xl border-b border-gray-300 px-4 py-3">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 bg-gray-400 rounded-full mx-auto mb-1 flex items-center justify-center">
                    <span className="text-white text-lg font-semibold">
                      {senderId.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-black">
                    {senderId || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Message Content */}
            <div className="min-h-[300px] p-4 bg-gradient-to-b from-gray-100 to-gray-50">
              {/* Today indicator */}
              <div className="text-center mb-4">
                <span className="text-xs text-gray-500 bg-gray-200/50 px-3 py-1 rounded-full">
                  Today {currentTime}
                </span>
              </div>

              {/* Message Bubble */}
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-[#E9E9EB] rounded-2xl rounded-tl-md px-4 py-2 shadow-sm">
                  <p className="text-black text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                    {message || 'Your message will appear here...'}
                  </p>
                </div>
              </div>

              {/* Delivery info */}
              <div className="text-center mt-6 space-y-1">
                <p className="text-xs text-gray-500">
                  This message will be sent to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                </p>
                {senderId && (
                  <p className="text-xs text-gray-400">
                    From: {senderId}
                  </p>
                )}
              </div>
            </div>

            {/* iMessage Input Bar (decorative) */}
            <div className="bg-gray-100 border-t border-gray-300 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full px-4 py-2 border border-gray-300">
                  <span className="text-gray-400 text-sm">iMessage</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="hero"
            className="flex-1"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
