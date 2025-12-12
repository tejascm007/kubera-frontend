// Admin API Service Layer for KUBERA Backend
// Aligned with actual backend /admin/* endpoints

import { ApiError, getToken, clearTokens } from './api';

const API_BASE = 'http://localhost:8000';

// ==================== ADMIN TOKEN MANAGEMENT ====================

export const getAdminToken = (): string | null => {
  return localStorage.getItem('kubera-admin-token');
};

export const setAdminToken = (token: string) => {
  localStorage.setItem('kubera-admin-token', token);
};

export const clearAdminToken = () => {
  localStorage.removeItem('kubera-admin-token');
  localStorage.removeItem('kubera-admin');
};

// ==================== ADMIN API REQUEST WRAPPER ====================

async function adminRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();

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

  if (response.status === 401 || response.status === 403) {
    clearAdminToken();
    window.location.href = '/admin';
    throw new ApiError(response.status, 'Admin session expired');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || error.message || 'Request failed', error.error_code);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ==================== ADMIN AUTH API ====================
// Backend: POST /admin/login/send-otp, POST /admin/login/verify-otp

export interface AdminLoginOTPResponse {
  success: boolean;
  message: string;
  email: string;
  otp_expires_in: number;
}

export interface AdminVerifyResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  admin_id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
}

export interface AdminInfo {
  admin_id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
}

export const adminAuthApi = {
  // POST /admin/login/send-otp - Request admin OTP
  sendOTP: async (email: string): Promise<AdminLoginOTPResponse> => {
    const response = await fetch(`${API_BASE}/admin/login/send-otp`, {
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

  // POST /admin/login/verify-otp - Verify admin OTP and get token
  verifyOTP: async (email: string, otp: string): Promise<AdminVerifyResponse> => {
    const response = await fetch(`${API_BASE}/admin/login/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Invalid OTP');
    }

    return response.json();
  },

  // Logout (no backend endpoint, just clear token)
  logout: async (): Promise<void> => {
    clearAdminToken();
  },
};

// ==================== ADMIN DASHBOARD API ====================
// Backend: GET /admin/dashboard, GET /admin/dashboard/prompt-activity

export interface DashboardStats {
  total_users: number;
  active_users: number;
  deactivated_users: number;
  total_chats: number;
  total_messages: number;
  total_prompts_today: number;
  total_prompts_this_week: number;
  total_prompts_this_month: number;
  total_rate_limit_violations: number;
  violations_today: number;
  system_status: string;
  portfolio_report_frequency: string;
  portfolio_report_last_sent?: string;
}

export interface PromptActivityDataPoint {
  label: string;
  value: number;
}

export interface PromptActivityResponse {
  success: boolean;
  period: string;
  data: PromptActivityDataPoint[];
}

export const adminDashboardApi = {
  // GET /admin/dashboard - Get dashboard statistics
  getStats: (): Promise<DashboardStats> =>
    adminRequest('/admin/dashboard'),

  // GET /admin/dashboard/prompt-activity - Get prompt activity time-series
  getPromptActivity: (period: '24h' | '7d' | '30d' = '24h'): Promise<PromptActivityResponse> =>
    adminRequest(`/admin/dashboard/prompt-activity?period=${period}`),
};

// ==================== ADMIN USERS API ====================
// Backend: GET /admin/users, GET /admin/users/{user_id}, PUT /admin/users/{user_id}/deactivate, PUT /admin/users/{user_id}/reactivate

export interface AdminUserListItem {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  account_status: string;
  email_verified: boolean;
  total_chats: number;
  total_prompts: number;
  created_at: string;
  last_login_at?: string;
}

export interface AdminUserDetail {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  account_status: string;
  email_verified: boolean;
  investment_style?: string;
  risk_tolerance?: string;
  interested_sectors?: string[];
  created_at: string;
  last_login_at?: string;
  total_chats: number;
  total_prompts: number;
  prompts_today: number;
  prompts_this_week: number;
  prompts_this_month: number;
  current_rate_limits: Record<string, number>;
  rate_limit_violations: number;
  total_portfolio_entries: number;
}

export interface UserListResponse {
  success: boolean;
  total_users: number;
  users: AdminUserListItem[];
}

export const adminUsersApi = {
  // GET /admin/users - Get all users with pagination
  getUsers: (limit: number = 100, offset: number = 0, accountStatus?: string): Promise<UserListResponse> => {
    let url = `/admin/users?limit=${limit}&offset=${offset}`;
    if (accountStatus) {
      url += `&account_status=${accountStatus}`;
    }
    return adminRequest(url);
  },

  // GET /admin/users/{user_id} - Get user details
  getUser: (userId: string): Promise<AdminUserDetail> =>
    adminRequest(`/admin/users/${userId}`),

  // PUT /admin/users/{user_id}/deactivate - Deactivate user
  deactivateUser: (userId: string, reason?: string): Promise<{ success: boolean; message: string; user_id: string; new_status: string }> =>
    adminRequest(`/admin/users/${userId}/deactivate`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  // PUT /admin/users/{user_id}/reactivate - Reactivate user
  reactivateUser: (userId: string): Promise<{ success: boolean; message: string; user_id: string; new_status: string }> =>
    adminRequest(`/admin/users/${userId}/reactivate`, {
      method: 'PUT',
    }),
};

// ==================== ADMIN RATE LIMITS API ====================
// Backend: GET /admin/rate-limits/config, PUT /admin/rate-limits/global, PUT /admin/rate-limits/user/{user_id}, etc.

export interface RateLimitConfig {
  config_id: string;
  burst_limit_per_minute: number;
  per_chat_limit: number;
  per_hour_limit: number;
  per_day_limit: number;
  user_specific_overrides: Record<string, unknown>;
  whitelisted_users: string[];
  updated_at: string;
}

export interface RateLimitViolation {
  violation_id: string;
  user_id: string;
  user_email: string;
  chat_id?: string;
  violation_type: string;
  limit_value: number;
  prompts_used: number;
  action_taken: string;
  user_message?: string;
  violated_at: string;
}

export interface ViolationsListResponse {
  success: boolean;
  total_violations: number;
  violations: RateLimitViolation[];
}

export const adminRateLimitsApi = {
  // GET /admin/rate-limits/config - Get rate limit configuration
  getConfig: (): Promise<RateLimitConfig> =>
    adminRequest('/admin/rate-limits/config'),

  // PUT /admin/rate-limits/global - Update global rate limits
  updateGlobal: (limits: Partial<{
    burst_limit_per_minute?: number;
    per_chat_limit?: number;
    per_hour_limit?: number;
    per_day_limit?: number;
  }>): Promise<{ success: boolean; message: string; config: RateLimitConfig }> =>
    adminRequest('/admin/rate-limits/global', {
      method: 'PUT',
      body: JSON.stringify(limits),
    }),

  // PUT /admin/rate-limits/user/{user_id} - Set user-specific rate limits
  setUserLimits: (userId: string, limits: Partial<{
    burst_limit_per_minute?: number;
    per_chat_limit?: number;
    per_hour_limit?: number;
    per_day_limit?: number;
  }>): Promise<{ success: boolean; message: string; config: RateLimitConfig }> =>
    adminRequest(`/admin/rate-limits/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(limits),
    }),

  // POST /admin/rate-limits/whitelist - Add user to whitelist
  addToWhitelist: (userId: string): Promise<{ success: boolean; message: string; user_id: string }> =>
    adminRequest('/admin/rate-limits/whitelist', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  // DELETE /admin/rate-limits/whitelist/{user_id} - Remove from whitelist
  removeFromWhitelist: (userId: string): Promise<{ success: boolean; message: string; user_id: string }> =>
    adminRequest(`/admin/rate-limits/whitelist/${userId}`, { method: 'DELETE' }),

  // POST /admin/rate-limits/reset/{user_id} - Reset user rate limit counters
  resetUserLimits: (userId: string): Promise<{ success: boolean; message: string; user_id: string }> =>
    adminRequest(`/admin/rate-limits/reset/${userId}`, { method: 'POST' }),

  // GET /admin/rate-limits/violations - Get rate limit violations
  getViolations: (limit: number = 100, offset: number = 0, violationType?: string): Promise<ViolationsListResponse> => {
    let url = `/admin/rate-limits/violations?limit=${limit}&offset=${offset}`;
    if (violationType) {
      url += `&violation_type=${violationType}`;
    }
    return adminRequest(url);
  },
};

// ==================== ADMIN PORTFOLIO REPORTS API ====================
// Backend: GET /admin/portfolio-reports/settings, PUT /admin/portfolio-reports/settings

export interface PortfolioReportSettings {
  frequency: string;
  send_time: string;
  send_day_weekly?: string;
  send_day_monthly?: number;
  timezone: string;
  last_sent?: string;
  next_scheduled?: string;
}

export const adminPortfolioReportsApi = {
  // GET /admin/portfolio-reports/settings - Get portfolio report settings
  getSettings: (): Promise<PortfolioReportSettings> =>
    adminRequest('/admin/portfolio-reports/settings'),

  // PUT /admin/portfolio-reports/settings - Update portfolio report settings
  updateSettings: (settings: {
    frequency: string;
    send_time: string;
    send_day_weekly?: number | string;
    send_day_monthly?: number;
  }): Promise<{ success: boolean; message: string; settings: PortfolioReportSettings }> =>
    adminRequest('/admin/portfolio-reports/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// ==================== ADMIN SYSTEM CONTROL API ====================
// Backend: POST /admin/system/control

export interface SystemControlResponse {
  success: boolean;
  message: string;
  action: string;
  system_status: string;
  timestamp: string;
}

export const adminSystemApi = {
  // POST /admin/system/control - System control (stop, start, restart)
  control: (action: 'stop' | 'start' | 'restart', reason?: string): Promise<SystemControlResponse> =>
    adminRequest('/admin/system/control', {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }),
};

// ==================== ADMIN ACTIVITY LOGS API ====================
// Backend: GET /admin/activity-logs

export interface ActivityLog {
  log_id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type?: string;
  target_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  performed_at: string;
}

export interface ActivityLogListResponse {
  success: boolean;
  total_logs: number;
  logs: ActivityLog[];
}

export const adminActivityLogsApi = {
  // GET /admin/activity-logs - Get admin activity logs
  getLogs: (limit: number = 100, offset: number = 0, adminId?: string, action?: string): Promise<ActivityLogListResponse> => {
    let url = `/admin/activity-logs?limit=${limit}&offset=${offset}`;
    if (adminId) {
      url += `&admin_id=${adminId}`;
    }
    if (action) {
      url += `&action=${action}`;
    }
    return adminRequest(url);
  },
};

// ==================== COMBINED ADMIN API EXPORT ====================
// For backwards compatibility

export const adminApi = {
  auth: adminAuthApi,
  dashboard: adminDashboardApi,
  users: adminUsersApi,
  rateLimits: adminRateLimitsApi,
  portfolioReports: adminPortfolioReportsApi,
  system: adminSystemApi,
  activityLogs: adminActivityLogsApi,
};
