import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Custom brain icon component
const BrainIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/brain-icon.png"
    alt="AI thinking"
    className={cn("h-3 w-3", className)}
  />
);

interface ToolStatus {
  tool_name: string;
  tool_id: string;
  status: 'executing' | 'complete' | 'error';
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  chartUrl?: string;
  isStreaming?: boolean;
  toolStatus?: ToolStatus[];
}

export function ChatMessage({ role, content, chartUrl, isStreaming, toolStatus = [] }: ChatMessageProps) {
  const isUser = role === 'user';
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const hasActiveTools = toolStatus.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex flex-col w-full animate-fade-in gap-2">
      {/* Message bubble - full width */}
      <div
        className={cn(
          'w-full px-4 py-3 rounded-lg font-raleway chat-message relative group',
          isUser
            ? 'bg-user-bubble text-user-bubble-foreground'
            : 'bg-bot-bubble text-bot-bubble-foreground'
        )}
      >
        {/* Copy button - top right corner */}
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
          title={copied ? "Copied!" : "Copy message"}
        >
          {copied ? (
            <span className="text-xs text-green-500">✓</span>
          ) : (
            <img src="/assets/copy-icon.png" alt="Copy" className="h-4 w-4 opacity-60" />
          )}
        </button>

        <p className={cn(
          "text-sm leading-relaxed whitespace-pre-wrap pr-6",
          isUser && "font-medium"  // Slightly bolder for user messages
        )}>
          {content}
          {isStreaming && (
            <span className="inline-flex ml-1">
              <span className="w-1 h-1 rounded-full bg-current animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-typing ml-0.5" style={{ animationDelay: '200ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-typing ml-0.5" style={{ animationDelay: '400ms' }} />
            </span>
          )}
        </p>

        {/* Chart Embed */}
        {chartUrl && (
          <div className="mt-3">
            <iframe
              src={chartUrl}
              width="100%"
              height="400"
              frameBorder="0"
              className="rounded-md border border-border"
              title="Stock Chart"
            />
          </div>
        )}
      </div>

      {/* Tool Status - Inline dropdown below the message */}
      {hasActiveTools && !isUser && (
        <div className="max-w-[80%] w-full">
          <button
            onClick={() => setToolsExpanded(!toolsExpanded)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
          >
            <BrainIcon className="h-3 w-3" />
            <span>Thinking ({toolStatus.length} tool{toolStatus.length > 1 ? 's' : ''})</span>
            {toolsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {toolsExpanded && (
            <div className="mt-1 ml-5 space-y-1 text-xs text-muted-foreground border-l-2 border-muted pl-3">
              {toolStatus.map((tool) => (
                <div key={tool.tool_id} className="flex items-center gap-2">
                  <BrainIcon className={cn(
                    "h-3 w-3",
                    tool.status === 'executing' && "animate-pulse text-primary",
                    tool.status === 'complete' && "text-green-500",
                    tool.status === 'error' && "text-destructive"
                  )} />
                  <span>{tool.tool_name.replace(/_/g, ' ')}</span>
                  {tool.status === 'executing' && <span className="opacity-60">...</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

