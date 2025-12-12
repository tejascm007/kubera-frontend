import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask about any Indian stock...' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 py-2 border-t border-border bg-background">
      <div className="flex justify-center items-center gap-3 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'w-full max-w-2xl resize-none rounded-none border-none bg-sidebar-accent text-foreground px-4 py-2.5 text-sm chat-input-scrollbar',
            'focus:outline-none',
            'transition-all duration-200 placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        <img
          src="/assets/send-icon.png"
          alt="Send"
          onClick={() => handleSubmit()}
          className={cn(
            "h-6 w-6 cursor-pointer transition-opacity shrink-0",
            (!message.trim() || disabled) ? "opacity-30 cursor-not-allowed" : "opacity-100 hover:opacity-80"
          )}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
