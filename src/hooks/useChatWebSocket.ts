import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl, getToken } from '@/lib/api';

// ==================== TYPES ====================

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface ToolStatus {
  tool_name: string;
  tool_id: string;
  status: 'executing' | 'complete' | 'error';
  timestamp: string;
}

export interface RateLimits {
  current: {
    burst: number;
    per_chat: number;
    hourly: number;
    daily: number;
  };
  limits: {
    burst: number;
    per_chat: number;
    hourly: number;
    daily: number;
  };
}

export interface ChartData {
  chart_url: string;
  chart_html?: string;  // HTML content for direct rendering
  chart_symbol: string;
  chart_available: boolean;
}

export interface ChatWebSocketState {
  isConnected: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  toolStatus: ToolStatus[];
  rateLimits: RateLimits | null;
  rateLimitExceeded: boolean;
  rateLimitResetTime: string | null;
  rateLimitDetails: {
    violation_type: string;
    limit: number;
    used: number;
  } | null;
  chartData: ChartData | null;
}

interface UseChatWebSocketOptions {
  chatId: string | null;
  onMessageComplete?: (content: string, metadata?: { tokens_used?: number; tools_used?: string[]; chart_url?: string; chart_html?: string }) => void;
  onError?: (error: string) => void;
  onChartGenerated?: (chartData: ChartData) => void;
  onRateLimitExceeded?: (message: string) => void;
  onChatRenamed?: (chatId: string, newName: string) => void;
}

// ==================== HOOK ====================

export function useChatWebSocket({
  chatId,
  onMessageComplete,
  onError,
  onChartGenerated,
  onRateLimitExceeded,
  onChatRenamed,
}: UseChatWebSocketOptions) {
  const [state, setState] = useState<ChatWebSocketState>({
    isConnected: false,
    isStreaming: false,
    streamingContent: '',
    error: null,
    toolStatus: [],
    rateLimits: null,
    rateLimitExceeded: false,
    rateLimitResetTime: null,
    rateLimitDetails: null,
    chartData: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageMetadataRef = useRef<{ tokens_used?: number; tools_used?: string[]; chart_url?: string }>({});
  const currentChatIdRef = useRef<string | null>(null);

  const maxReconnectAttempts = 5;
  const reconnectBaseDelay = 3000;

  // ==================== CONNECTION ====================

  const connect = useCallback(() => {
    // Need both token and chatId to connect
    if (!getToken() || !chatId) {
      console.log('[WS] Cannot connect: missing token or chatId');
      return;
    }

    // Close existing connection if chatId changed
    if (wsRef.current && currentChatIdRef.current !== chatId) {
      wsRef.current.close(1000, 'Switching chat');
    }

    currentChatIdRef.current = chatId;

    // Backend WebSocket URL format: /ws/chat/{chat_id}?token=JWT
    const url = getWebSocketUrl(chatId);
    console.log('[WS] Connecting to:', url);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      reconnectAttemptsRef.current = 0;
      setState(prev => ({ ...prev, isConnected: true, error: null }));

      // Start heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        console.log('[WS] Message:', data.type, data);

        switch (data.type) {
          // Connection confirmation (backend sends this after accepting)
          case 'connected':
            console.log('[WS] Connection confirmed, user:', data.user_id, 'chat:', data.chat_id);
            break;

          // Rate limit info
          case 'rate_limit_info':
            setState(prev => ({
              ...prev,
              rateLimits: {
                current: data.current_usage,
                limits: data.limits,
              },
            }));
            break;

          // Message acknowledged by server
          case 'message_received':
            console.log('[WS] Message acknowledged:', data.message_id);
            break;

          // Tool execution started
          case 'tool_executing':
            setState(prev => ({
              ...prev,
              toolStatus: [
                ...prev.toolStatus,
                {
                  tool_name: data.tool_name,
                  tool_id: data.tool_id || Date.now().toString(),
                  status: 'executing',
                  timestamp: data.timestamp || new Date().toISOString(),
                },
              ],
            }));
            lastMessageMetadataRef.current.tools_used = [
              ...(lastMessageMetadataRef.current.tools_used || []),
              data.tool_name,
            ];
            break;

          // Tool execution complete
          case 'tool_complete':
            setState(prev => ({
              ...prev,
              toolStatus: prev.toolStatus.map(t =>
                t.tool_name === data.tool_name
                  ? { ...t, status: 'complete' }
                  : t
              ),
            }));
            // Auto-dismiss after 2 seconds
            setTimeout(() => {
              setState(prev => ({
                ...prev,
                toolStatus: prev.toolStatus.filter(t => t.tool_name !== data.tool_name),
              }));
            }, 2000);
            break;

          // Tool error
          case 'tool_error':
            console.error('[WS] Tool error:', data.error);
            setState(prev => ({
              ...prev,
              toolStatus: prev.toolStatus.map(t =>
                t.tool_name === data.tool_name
                  ? { ...t, status: 'error' }
                  : t
              ),
            }));
            break;

          // Streaming text chunk (backend may send as 'chunk' or 'text_chunk')
          case 'chunk':
          case 'text_chunk':
            const chunkContent = data.chunk || data.content || '';
            streamingContentRef.current += chunkContent;
            setState(prev => ({
              ...prev,
              isStreaming: true,
              streamingContent: streamingContentRef.current,
            }));
            break;

          // Chart generated
          case 'chart_generated':
            if (data.chart_available && data.chart_url) {
              const chartData: ChartData = {
                chart_url: data.chart_url,
                chart_symbol: data.stock_symbol || data.symbol || '',
                chart_available: true,
              };
              setState(prev => ({ ...prev, chartData }));
              lastMessageMetadataRef.current.chart_url = data.chart_url;
              onChartGenerated?.(chartData);
            }
            break;

          // Message complete (backend may send as 'complete' or 'message_complete')
          case 'complete':
          case 'message_complete':
            const finalContent = streamingContentRef.current;

            // Extract metadata - backend sends it in data.metadata
            const backendMetadata = data.metadata || {};
            const metadata = {
              tokens_used: data.tokens_used || backendMetadata.tokens_used,
              tools_used: data.tools_used || backendMetadata.tools_used || lastMessageMetadataRef.current.tools_used,
              // Chart URL can come from backend metadata OR from earlier chart_generated event
              chart_url: backendMetadata.chart_url || lastMessageMetadataRef.current.chart_url,
              // Chart HTML for direct rendering (no iframe needed)
              chart_html: backendMetadata.chart_html,
            };

            console.log('[WS] Message complete, metadata:', metadata);

            streamingContentRef.current = '';
            lastMessageMetadataRef.current = {};

            setState(prev => ({
              ...prev,
              isStreaming: false,
              streamingContent: '',
              toolStatus: [],
              chartData: null,
            }));

            onMessageComplete?.(finalContent, metadata);
            break;

          // Rate limit exceeded
          case 'rate_limit':
          case 'rate_limit_exceeded':
            const resetTime = data.details?.reset_time || null;
            const violationType = data.details?.violation_type || 'unknown';
            const limitValue = data.details?.limit || 0;
            const usedValue = data.details?.used || 0;

            // Calculate time until reset
            let resetMessage = '';
            if (resetTime) {
              const resetDate = new Date(resetTime);
              const now = new Date();
              const diffMs = resetDate.getTime() - now.getTime();
              const diffMins = Math.ceil(diffMs / 60000);

              if (diffMins > 60) {
                const hours = Math.floor(diffMins / 60);
                resetMessage = ` Resets in ${hours} hour${hours > 1 ? 's' : ''}.`;
              } else if (diffMins > 0) {
                resetMessage = ` Resets in ${diffMins} minute${diffMins > 1 ? 's' : ''}.`;
              } else {
                resetMessage = ' Please try again.';
              }
            }

            const errorMsg = (data.error || data.message || 'Rate limit exceeded.') + resetMessage;

            setState(prev => ({
              ...prev,
              error: errorMsg,
              isStreaming: false,
              rateLimitExceeded: true,
              rateLimitResetTime: resetTime,
              rateLimitDetails: resetTime ? { violation_type: violationType, limit: limitValue, used: usedValue } : null,
            }));
            onRateLimitExceeded?.(errorMsg);
            onError?.(errorMsg);
            break;

          // Error
          case 'error':
            const errMessage = data.message || data.error || 'An error occurred';
            console.error('[WS] Error from server:', errMessage);
            setState(prev => ({
              ...prev,
              error: errMessage,
              isStreaming: false,
            }));
            onError?.(errMessage);
            break;

          // Pong (heartbeat response)
          case 'pong':
            // Heartbeat acknowledged
            break;

          // Chat renamed (auto-naming from first message)
          case 'chat_renamed':
            console.log('[WS] Chat renamed:', data.chat_id, data.new_name);
            onChatRenamed?.(data.chat_id, data.new_name);
            break;

          default:
            console.warn('[WS] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      setState(prev => ({ ...prev, error: 'Connection error' }));
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      setState(prev => ({ ...prev, isConnected: false }));

      // Don't reconnect on intentional close (1000) or auth errors (1008)
      if (event.code === 1000 || event.code === 1008 || event.code === 4001 || event.code === 4003) {
        return;
      }

      // Attempt reconnection with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts && chatId) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(
          reconnectBaseDelay * Math.pow(2, reconnectAttemptsRef.current - 1),
          30000
        );
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to reconnect. Please refresh the page.',
        }));
        onError?.('Failed to reconnect. Please refresh the page.');
      }
    };
  }, [chatId, onMessageComplete, onError, onChartGenerated, onRateLimitExceeded, onChatRenamed]);

  // ==================== DISCONNECT ====================

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    currentChatIdRef.current = null;
    streamingContentRef.current = '';
    lastMessageMetadataRef.current = {};
    setState({
      isConnected: false,
      isStreaming: false,
      streamingContent: '',
      error: null,
      toolStatus: [],
      rateLimits: null,
      rateLimitExceeded: false,
      rateLimitResetTime: null,
      rateLimitDetails: null,
      chartData: null,
    });
  }, []);

  // ==================== SEND MESSAGE ====================

  const sendMessage = useCallback((targetChatId: string, message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send: not connected');
      return false;
    }

    if (!targetChatId) {
      console.error('[WS] Cannot send: no chat ID');
      return false;
    }

    // Backend expects message in a specific format
    // The chat_id is already in the URL, but we send the message content
    const payload = {
      type: 'message',
      message: message,
    };

    console.log('[WS] Sending:', payload);
    wsRef.current.send(JSON.stringify(payload));

    // Reset streaming state
    streamingContentRef.current = '';
    lastMessageMetadataRef.current = {};
    setState(prev => ({
      ...prev,
      isStreaming: true,
      streamingContent: '',
      error: null,
      toolStatus: [],
      chartData: null,
      rateLimitExceeded: false,
    }));

    return true;
  }, []);

  // ==================== EFFECTS ====================

  // Connect when chatId changes
  useEffect(() => {
    if (getToken() && chatId) {
      // Disconnect from previous chat and connect to new one
      if (currentChatIdRef.current !== chatId) {
        disconnect();
        connect();
      } else if (!state.isConnected) {
        connect();
      }
    }

    return () => {
      // Only disconnect on unmount, not on chatId change
    };
  }, [chatId, connect, disconnect, state.isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
