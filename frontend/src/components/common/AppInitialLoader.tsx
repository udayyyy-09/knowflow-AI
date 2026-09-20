import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Configure the duration (in milliseconds) for the initial application splash loader.
 * You can change this constant anytime to increase or decrease the display time.
 * Default: 3000ms (3 seconds)
 */
export const APP_INITIAL_LOADER_DURATION_MS = 3000;

interface AppInitialLoaderProps {
  /** Optional custom message shown beneath the loader */
  message?: string;
}

export const AppInitialLoader: React.FC<AppInitialLoaderProps> = ({
  message = 'Starting KnowFlow AI...',
}) => {
  return (
    <div
      id="app-initial-splash"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#F6F5F0] text-[#1B1F27] transition-opacity duration-300 select-none"
    >
      {/* Centered Brand / Logo Container */}
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-14 h-14 rounded-2xl bg-white border border-[#DDD9CC] shadow-sm flex items-center justify-center text-[#2E6F5E]">
          <Sparkles className="w-7 h-7 animate-pulse text-[#2E6F5E]" />
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-xl font-serif font-bold tracking-tight text-[#1B1F27]">
            KnowFlow <span className="text-[#2E6F5E]">AI</span>
          </h1>
          <p className="text-xs font-medium text-[#5B6270] tracking-wide">
            Enterprise Multimodal Knowledge Engine
          </p>
        </div>

        {/* Custom Animated Bouncing Ball Loader */}
        <div className="py-3 flex items-center justify-center">
          <div className="loader" />
        </div>

        {/* Status Message */}
        <p className="text-xs text-[#8C93A0] tracking-normal font-sans animate-pulse">
          {message}
        </p>
      </div>

      {/* Subtle Bottom Watermark */}
      <div className="absolute bottom-6 text-[11px] text-[#8C93A0] tracking-wider uppercase font-semibold">
        Secured with Role-Based Access &amp; Vector Embeddings
      </div>
    </div>
  );
};
