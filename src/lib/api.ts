// API Configuration and Service Layer for KUBERA Backend
// Aligned with actual backend endpoints

const API_BASE = 'https://kubera-1.onrender.com';
const WS_BASE = 'wss://kubera-1.onrender.com';

// ==================== TOKEN MANAGEMENT ====================
// Supports "Remember Me" feature:
// - Checked: Store in localStorage (persists across browser sessions)
// - Unchecked: Store in sessionStorage (cleared when browser closes)

// Key to track which storage is being used
const STORAGE_TYPE_KEY = 'kubera-storage-type';

// Get the appropriate storage based on saved preference
const getStorage = (): Storage => {
  // Check if we previously set to use sessionStorage
  const storageType = localStorage.getItem(STORAGE_TYPE_KEY) || sessionStorage.getItem(STORAGE_TYPE_KEY);
  return storageType === 'session' ? sessionStorage : localStorage;
};

export const getToken = (): string | null => {
  // Check both storages - one will have it if logged in
  return localStorage.getItem('kubera-token') || sessionStorage.getItem('kubera-token');
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('kubera-refresh-token') || sessionStorage.getItem('kubera-refresh-token');
};

export const setTokens = (accessToken: string, refreshToken?: string, rememberMe: boolean = true) => {
  // Clear any existing tokens from both storages first
  localStorage.removeItem('kubera-token');
  localStorage.removeItem('kubera-refresh-token');
  sessionStorage.removeItem('kubera-token');
  sessionStorage.removeItem('kubera-refresh-token');

  // Choose storage based on rememberMe
  const storage = rememberMe ? localStorage : sessionStorage;

  // Mark which storage type we're using
  if (rememberMe) {
    localStorage.setItem(STORAGE_TYPE_KEY, 'local');
    sessionStorage.removeItem(STORAGE_TYPE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_TYPE_KEY, 'session');
    localStorage.removeItem(STORAGE_TYPE_KEY);
  }

  storage.setItem('kubera-token', accessToken);
  if (refreshToken) {
    storage.setItem('kubera-refresh-token', refreshToken);
  }
};

export const clearTokens = () => {
  // Clear from both storages
  localStorage.removeItem('kubera-token');
  localStorage.removeItem('kubera-refresh-token');
  localStorage.removeItem('kubera-user');
  localStorage.removeItem(STORAGE_TYPE_KEY);
  sessionStorage.removeItem('kubera-token');
  sessionStorage.removeItem('kubera-refresh-token');
  sessionStorage.removeItem('kubera-user');
  sessionStorage.removeItem(STORAGE_TYPE_KEY);
};

// ==================== API REQUEST WRAPPER ====================

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getToken();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw new ApiError(retryResponse.status, error.detail || error.message || 'Request failed', error.error_code);
      }
      return retryResponse.json();
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || error.message || 'Request failed', error.error_code);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    }
  } catch {
    // Refresh failed
  }
  return false;
}

// ==================== AUTH API ====================
// Backend: /auth/* routes

export interface UserInfo {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
  profile_picture_url?: string;
  investment_style?: string;
  risk_tolerance?: string;
  interested_sectors?: string[];
  account_status: string;
  email_verified: boolean;
  theme_preference: string;
  language_preference: string;
  created_at: string;
  last_login_at?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user: UserInfo;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterStep1Response {
  success: boolean;
  message: string;
  email: string;
  otp_expires_in: number;
}

export interface RegisterStep2Response {
  success: boolean;
  message: string;
  email: string;
  verified: boolean;
}

export interface RegisterStep3Response {
  success: boolean;
  message: string;
  user: UserInfo;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterStep3Data {
  email: string;
  username: string;
  password: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
  investment_style?: string;
  risk_tolerance?: string;
  interested_sectors?: string[];
}

export const authApi = {
  // POST /auth/login - Login with username and password
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || error.message || 'Invalid credentials', error.error_code);
    }

    return response.json();
  },

  // POST /auth/register/step1 - Send OTP to email
  registerStep1: async (email: string): Promise<RegisterStep1Response> => {
    const response = await fetch(`${API_BASE}/auth/register/step1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || error.message || 'Failed to send OTP', error.error_code);
    }

    return response.json();
  },

  // POST /auth/register/step2 - Verify OTP
  registerStep2: async (email: string, otp: string): Promise<RegisterStep2Response> => {
    const response = await fetch(`${API_BASE}/auth/register/step2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || error.message || 'Invalid OTP', error.error_code);
    }

    return response.json();
  },

  // POST /auth/register/step3 - Complete registration
  registerStep3: async (data: RegisterStep3Data): Promise<RegisterStep3Response> => {
    const response = await fetch(`${API_BASE}/auth/register/step3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || error.message || 'Registration failed', error.error_code);
    }

    return response.json();
  },

  // GET /auth/check-username/{username} - Check username availability
  checkUsername: async (username: string): Promise<{ available: boolean; username: string; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/check-username/${encodeURIComponent(username)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to check username');
    }
    return response.json();
  },

  // POST /auth/password-reset/send-otp - Send password reset OTP
  sendPasswordResetOTP: async (email: string): Promise<{ success: boolean; message: string; email: string; otp_expires_in: number }> => {
    const response = await fetch(`${API_BASE}/auth/password-reset/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to send OTP');
    }

    return response.json();
  },

  // POST /auth/password-reset/confirm - Confirm password reset with OTP
  confirmPasswordReset: async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to reset password');
    }

    return response.json();
  },

  // POST /auth/forgot-password/send-otp - Alternative forgot password OTP
  sendForgotPasswordOTP: async (email: string): Promise<{ success: boolean; message: string; email: string; otp_expires_in: number }> => {
    const response = await fetch(`${API_BASE}/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to send OTP');
    }

    return response.json();
  },

  // POST /auth/forgot-password/confirm - Confirm forgot password with OTP
  confirmForgotPassword: async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/forgot-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to reset password');
    }

    return response.json();
  },

  // POST /auth/refresh - Refresh access token
  refresh: async (refreshToken: string): Promise<{ access_token: string; refresh_token: string; token_type: string; expires_in: number }> => {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to refresh token');
    }

    return response.json();
  },

  // POST /auth/logout - Logout user (requires refresh_token in body)
  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } finally {
      clearTokens();
    }
  },
};

// ==================== USER API ====================
// Backend: /user/* routes

export interface UserProfile {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
  profile_picture_url?: string;
  investment_style?: string;
  risk_tolerance?: string;
  interested_sectors?: string[];
  account_status: string;
  email_verified: boolean;
  theme_preference?: string;
  language_preference?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface UserStats {
  success: boolean;
  stats: {
    total_chats: number;
    total_messages: number;
    total_prompts: number;
    portfolio_count: number;
  };
}

export interface EmailPreferences {
  preference_id: string;
  user_id: string;
  portfolio_reports: boolean;
  security_alerts: boolean;
  rate_limit_notifications: boolean;
  system_notifications: boolean;
  promotional_emails: boolean;
  updated_at: string;
}

export const userApi = {
  // GET /user/profile - Get current user profile
  getProfile: (): Promise<UserProfile> =>
    apiRequest('/user/profile'),

  // PUT /user/profile - Update user profile
  updateProfile: (data: Partial<{
    full_name?: string;
    phone?: string;
    date_of_birth?: string;
    profile_picture_url?: string;
    investment_style?: string;
    risk_tolerance?: string;
    interested_sectors?: string[];
    theme_preference?: string;
    language_preference?: string;
  }>): Promise<{ success: boolean; message: string; user: UserProfile }> =>
    apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // PUT /user/username - Update username
  updateUsername: (newUsername: string): Promise<{ success: boolean; message: string; new_username: string }> =>
    apiRequest('/user/username', {
      method: 'PUT',
      body: JSON.stringify({ new_username: newUsername }),
    }),

  // PUT /user/password - Change password
  changePassword: (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> =>
    apiRequest('/user/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  // GET /user/email-preferences - Get email preferences
  getEmailPreferences: (): Promise<EmailPreferences> =>
    apiRequest('/user/email-preferences'),

  // PUT /user/email-preferences - Update email preferences
  updateEmailPreferences: (data: Partial<{
    portfolio_reports?: boolean;
    security_alerts?: boolean;
    rate_limit_notifications?: boolean;
    system_notifications?: boolean;
    promotional_emails?: boolean;
  }>): Promise<{ success: boolean; message: string; preferences: EmailPreferences }> =>
    apiRequest('/user/email-preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // GET /user/stats - Get user statistics
  getStats: (): Promise<UserStats> =>
    apiRequest('/user/stats'),
};

// ==================== PORTFOLIO API ====================
// Backend: /portfolio/* routes

export interface PortfolioEntry {
  portfolio_id: string;
  user_id: string;
  stock_symbol: string;
  exchange: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
  investment_type?: string;
  notes?: string;
  current_price?: number;
  current_value?: number;
  gain_loss?: number;
  gain_loss_percent?: number;
  created_at: string;
  updated_at: string;
  price_last_updated?: string;
}

export interface PortfolioSummary {
  total_entries: number;
  total_invested: number;
  current_value: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  last_updated?: string;
}

export interface PortfolioListResponse {
  success: boolean;
  summary: PortfolioSummary;
  portfolio: PortfolioEntry[];
}

export const portfolioApi = {
  // GET /portfolio/ - Get all portfolio entries with summary
  getPortfolio: (): Promise<PortfolioListResponse> =>
    apiRequest('/portfolio/'),

  // POST /portfolio/ - Add new portfolio entry
  addEntry: (data: {
    stock_symbol: string;
    exchange?: string;
    quantity: number;
    buy_price: number;
    buy_date: string;
    investment_type?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; portfolio_entry: PortfolioEntry }> =>
    apiRequest('/portfolio/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // PUT /portfolio/{portfolio_id} - Update portfolio entry
  updateEntry: (portfolioId: string, data: Partial<{
    quantity?: number;
    buy_price?: number;
    buy_date?: string;
    investment_type?: string;
    notes?: string;
  }>): Promise<{ success: boolean; message: string; portfolio_entry: PortfolioEntry }> =>
    apiRequest(`/portfolio/${portfolioId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // DELETE /portfolio/{portfolio_id} - Delete portfolio entry
  deleteEntry: (portfolioId: string): Promise<{ success: boolean; message: string; deleted_portfolio_id: string }> =>
    apiRequest(`/portfolio/${portfolioId}`, { method: 'DELETE' }),

  // POST /portfolio/update-prices - Update all portfolio prices
  updatePrices: (): Promise<{ success: boolean; message: string }> =>
    apiRequest('/portfolio/update-prices', { method: 'POST' }),
};

// ==================== CHATS API ====================
// Backend: /chats/* routes

export interface ChatSummary {
  chat_id: string;
  user_id: string;
  chat_name: string;
  total_prompts: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export interface ChatMessage {
  message_id: string;
  chat_id: string;
  user_id: string;
  user_message: string;
  assistant_response?: string;
  tokens_used?: number;
  mcp_servers_called?: string[];
  mcp_tools_used?: string[];
  charts_generated: number;
  chart_url?: string;  // Chart URL for visualizations
  processing_time_ms?: number;
  llm_model?: string;
  created_at: string;
}

export interface ChatListResponse {
  success: boolean;
  total_chats: number;
  chats: ChatSummary[];
}

export interface ChatMessagesResponse {
  success: boolean;
  chat: ChatSummary;
  messages: ChatMessage[];
  total_messages: number;
}

export const chatsApi = {
  // GET /chats/ - Get all chats
  getChats: (limit: number = 50, offset: number = 0): Promise<ChatListResponse> =>
    apiRequest(`/chats/?limit=${limit}&offset=${offset}`),

  // GET /chats/{chat_id} - Get chat with messages
  getChat: (chatId: string, limit: number = 100, offset: number = 0): Promise<ChatMessagesResponse> =>
    apiRequest(`/chats/${chatId}?limit=${limit}&offset=${offset}`),

  // POST /chats/ - Create new chat
  createChat: (chatName?: string): Promise<{ success: boolean; message: string; chat: ChatSummary }> =>
    apiRequest('/chats/', {
      method: 'POST',
      body: JSON.stringify({ chat_name: chatName || 'New Chat' }),
    }),

  // PUT /chats/{chat_id}/rename - Rename chat
  renameChat: (chatId: string, newName: string): Promise<{ success: boolean; message: string; chat: ChatSummary }> =>
    apiRequest(`/chats/${chatId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ new_name: newName }),
    }),

  // DELETE /chats/{chat_id} - Delete chat
  deleteChat: (chatId: string): Promise<{ success: boolean; message: string; deleted_chat_id: string }> =>
    apiRequest(`/chats/${chatId}`, { method: 'DELETE' }),
};

// ==================== WEBSOCKET ====================
// Backend: /ws/chat/{chat_id}?token=JWT

export const getWebSocketUrl = (chatId: string): string => {
  const token = getToken();
  return `${WS_BASE}/ws/chat/${chatId}?token=${token}`;
};

// WebSocket message types for reference
export interface WebSocketMessage {
  type: 'connected' | 'chunk' | 'complete' | 'error' | 'rate_limit' | 'tool_call';
  chat_id?: string;
  user_id?: string;
  message?: string;
  chunk?: string;
  message_id?: string;
  complete?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export { API_BASE, WS_BASE };
