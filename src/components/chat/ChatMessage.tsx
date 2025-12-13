import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Custom brain icon component
const BrainIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/brain-icon.png"
    alt="AI thinking"
    className={cn("h-3 w-3", className)}
  />
);

// Custom code block component with syntax highlighting
const CodeBlock = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const [copied, setCopied] = useState(false);

  // Extract the code text from children
  const codeText = String(children).replace(/\n$/, '');

  // Extract language from className (e.g., "language-python" -> "python")
  const language = className?.replace('language-', '') || 'text';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Check if it's an inline code or block code
  const isInline = !className;

  if (isInline) {
    return (
      <code className="font-code px-1 py-0.5 rounded text-sm text-inherit">
        {children}
      </code>
    );
  }

  return (
    <div className="my-2 overflow-hidden">
      {/* Header bar - minimal with language and copy */}
      <div className="flex items-center justify-between py-1">
        <span className="text-xs text-muted-foreground font-code">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1 hover:opacity-80 transition-opacity"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <img src="/assets/copy-icon.png" alt="Copy" className="h-3 w-3 opacity-60" />
          )}
        </button>
      </div>
      {/* Code content with syntax highlighting - using One Light theme */}
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        customStyle={{
          background: 'transparent',
          padding: 0,
          margin: 0,
          fontSize: '0.875rem',
          fontFamily: '"Cascadia Code", monospace',
        }}
        codeTagProps={{
          className: 'font-code',
          style: { fontWeight: 500 }
        }}
      >
        {codeText}
      </SyntaxHighlighter>
    </div>
  );
};



interface ToolStatus {
  tool_name: string;
  tool_id: string;
  status: 'executing' | 'complete' | 'error';
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  chartUrl?: string;
  chartHtml?: string;  // Chart HTML for direct rendering
  isStreaming?: boolean;
  toolStatus?: ToolStatus[];
  onChartClick?: (chartUrl: string | null, chartHtml: string | null, chartName: string) => void;
}

export function ChatMessage({ role, content, chartUrl, chartHtml, isStreaming, toolStatus = [], onChartClick }: ChatMessageProps) {
  const isUser = role === 'user';
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const hasActiveTools = toolStatus.length > 0;

  // Extract chart URL from content if not provided as prop
  // The LLM may include it as a markdown link in the response
  const extractedChartUrl = !chartUrl && !chartHtml ? (() => {
    const urlMatch = content.match(/https:\/\/[^\s)]+supabase[^\s)]+charts[^\s)]+\.html/);
    return urlMatch ? urlMatch[0] : null;
  })() : null;

  // Use provided chartUrl or extracted one
  const effectiveChartUrl = chartUrl || extractedChartUrl;
  const hasChart = !!(effectiveChartUrl || chartHtml);

  // Extract chart name from URL for display
  const chartName = effectiveChartUrl
    ? effectiveChartUrl.split('/').pop()?.replace(/_/g, ' ').replace('.html', '') || 'Stock Chart'
    : 'Stock Chart';

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

        {/* Message content - Markdown for assistant, plain text for user */}
        <div className={cn(
          "text-sm leading-relaxed pr-6 break-words overflow-wrap-anywhere",
          isUser && "font-bold whitespace-pre-wrap"
        )}>
          {isUser ? (
            // User messages - plain text, bolder
            <>{content}</>
          ) : (
            // Assistant messages - Markdown rendered
            // Headers reduced by 1 level: h1→lg, h2→base, h3→sm, h4→sm
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:my-1.5 prose-headings:font-medium
              prose-h1:text-lg prose-h1:font-medium
              prose-h2:text-base prose-h2:font-medium
              prose-h3:text-sm prose-h3:font-medium
              prose-h4:text-sm prose-h4:font-normal
              prose-p:my-1.5 prose-p:leading-relaxed
              prose-ul:my-1.5 prose-ol:my-1.5
              prose-li:my-0.5
              prose-strong:font-medium prose-strong:text-inherit
              prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80
              prose-img:rounded-md prose-img:my-2
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ children, className }) => (
                    <CodeBlock className={className}>{children}</CodeBlock>
                  ),
                  pre: ({ children }) => <>{children}</>,
                  // Custom link handler - hide chart URLs (we display them as button)
                  a: ({ href, children }) => {
                    // Hide Supabase chart links
                    if (href?.includes('supabase') && href?.includes('charts')) {
                      return null; // Don't render - chart button handles this
                    }
                    // Render other links normally
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a>;
                  },
                  // Custom image handler - hide chart URLs (they're HTML files, not images)
                  img: ({ src, alt }) => {
                    // Skip Supabase chart URLs (they're HTML files, not images)
                    if (src?.includes('supabase') && src?.includes('charts')) {
                      return null; // Don't render - chart button handles this
                    }
                    // Render other images normally
                    return <img src={src} alt={alt || ''} className="rounded-md my-2" />;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          {isStreaming && (
            <span className="inline-flex ml-1">
              <span className="w-1 h-1 rounded-full bg-current animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-typing ml-0.5" style={{ animationDelay: '200ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-typing ml-0.5" style={{ animationDelay: '400ms' }} />
            </span>
          )}
        </div>

        {/* Chart Preview Button - compact inline style */}
        {hasChart && (
          <button
            onClick={() => onChartClick?.(effectiveChartUrl, chartHtml || null, chartName)}
            className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono bg-muted border border-border hover:bg-muted/80 hover:border-primary/50 transition-colors cursor-pointer"
            title="Click to view chart"
          >
            <img src="/assets/chart-icon.png" alt="Chart" className="w-4 h-4" />
            <span className="truncate max-w-[250px]">{chartName}</span>
          </button>
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

