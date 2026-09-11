import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, StopCircle } from 'lucide-react';
import { Button } from '@/components/common/Button';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  suggestions?: string[];
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  isStreaming = false,
  onStop,
  suggestions = [],
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || disabled || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-[#F6F5F0]/90 backdrop-blur-lg border-t border-[#DDD9CC]">
      {/* Dynamic Document Quick Prompts (Rendered only when active documents exist) */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none animate-in fade-in duration-200">
          <span className="text-[11px] text-[#5B6270] flex items-center gap-1 shrink-0 font-medium">
            <Sparkles className="w-3 h-3 text-[#2E6F5E]" /> Suggestions:
          </span>
          {suggestions.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled || isStreaming}
              onClick={() => {
                setInput(prompt);
                textareaRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg text-xs bg-white hover:bg-[#F2EFE9] text-[#1B1F27] border border-[#DDD9CC] transition whitespace-nowrap shrink-0 disabled:opacity-50 shadow-xs active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-white rounded-2xl border border-[#DDD9CC] focus-within:border-[#1B1F27] focus-within:ring-2 focus-within:ring-[#1B1F27]/10 p-2 transition shadow-xs">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          placeholder="Ask anything grounded in your workspace documents... (Enter to send, Shift+Enter for new line)"
          className="w-full bg-transparent text-sm text-[#1B1F27] placeholder-[#8C93A0] px-3 py-1.5 focus:outline-none resize-none max-h-44 disabled:opacity-50 font-normal"
        />

        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          {isStreaming ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onStop}
              className="rounded-xl px-3 h-9"
            >
              <StopCircle className="w-4 h-4 mr-1 animate-pulse" />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!input.trim() || disabled}
              className="rounded-xl px-3.5 h-9"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>

      <div className="flex items-center justify-between text-[11px] text-[#8C93A0] px-1 mt-1.5 font-mono">
        <span>Shift + Enter for new line</span>
      </div>
    </div>
  );
};
