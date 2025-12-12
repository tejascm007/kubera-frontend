import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Activity,
  AlertTriangle,
  Settings,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
  Power,
  Play,
  RotateCcw,
  UserCheck,
  UserX,
  Eye,
  Plus,
  Trash2,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  adminDashboardApi,
  adminUsersApi,
  adminRateLimitsApi,
  adminPortfolioReportsApi,
  adminSystemApi,
  adminActivityLogsApi,
  DashboardStats,
  AdminUserListItem,
  AdminUserDetail,
  RateLimitConfig,
  RateLimitViolation,
  PortfolioReportSettings,
  ActivityLog,
  PromptActivityDataPoint,
} from '@/lib/adminApi';

// ==================== COMPONENT ====================

export default function AdminDashboard() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dashboard stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Users
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const USERS_PER_PAGE = 10;

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // Rate limits
  const [rateLimits, setRateLimits] = useState({
    burst: 10,
    perChat: 50,
    hourly: 150,
    daily: 1000,
  });
  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [rateLimitLoading, setRateLimitLoading] = useState(true);
  const [rateLimitSaving, setRateLimitSaving] = useState(false);

  // Violations
  const [violations, setViolations] = useState<RateLimitViolation[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(true);
  const [violationsPage, setViolationsPage] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);

  // Target username for rate limit operations
  const [targetUsername, setTargetUsername] = useState('');
  const [whitelistLoading, setWhitelistLoading] = useState(false);

  // Portfolio reports
  const [reportSettings, setReportSettings] = useState<PortfolioReportSettings | null>(null);
  const [reportSettingsLoading, setReportSettingsLoading] = useState(true);
  const [reportSaving, setReportSaving] = useState(false);

  // Activity logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);

  // System control
  const [systemControlLoading, setSystemControlLoading] = useState<string | null>(null);

  // User-specific rate limits (for modal)
  const [userRateLimits, setUserRateLimits] = useState({
    burst: 0,
    perChat: 0,
    hourly: 0,
    daily: 0,
  });
  const [userRateLimitSaving, setUserRateLimitSaving] = useState(false);

  // Donut chart hover explode effect
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Prompt activity time-series
  const [promptActivityPeriod, setPromptActivityPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [promptActivityData, setPromptActivityData] = useState<PromptActivityDataPoint[]>([]);
  const [promptActivityLoading, setPromptActivityLoading] = useState(true);

  // ==================== AUTH CHECK ====================

  useEffect(() => {
    const token = localStorage.getItem('kubera-admin-token');
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  // ==================== FETCH FUNCTIONS ====================

  const fetchDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const data = await adminDashboardApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      toast({ title: 'Failed to load stats', variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPromptActivity = async (period: '24h' | '7d' | '30d' = promptActivityPeriod) => {
    setPromptActivityLoading(true);
    try {
      const data = await adminDashboardApi.getPromptActivity(period);
      setPromptActivityData(data.data);
    } catch (error) {
      console.error('Failed to fetch prompt activity:', error);
      toast({ title: 'Failed to load prompt activity', variant: 'destructive' });
    } finally {
      setPromptActivityLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await adminUsersApi.getUsers(USERS_PER_PAGE, userPage * USERS_PER_PAGE);
      setTotalUsers(data.total_users);
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({ title: 'Failed to load users', variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const data = await adminUsersApi.getUser(userId);
      setSelectedUser(data);
      setShowUserModal(true);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      toast({ title: 'Failed to load user details', variant: 'destructive' });
    } finally {
      setUserDetailLoading(false);
    }
  };

  const fetchRateLimits = async () => {
    setRateLimitLoading(true);
    try {
      const config = await adminRateLimitsApi.getConfig();
      setRateLimitConfig(config);
      setRateLimits({
        burst: config.burst_limit_per_minute,
        perChat: config.per_chat_limit,
        hourly: config.per_hour_limit,
        daily: config.per_day_limit,
      });
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
      toast({ title: 'Failed to load rate limits', variant: 'destructive' });
    } finally {
      setRateLimitLoading(false);
    }
  };

  const fetchViolations = async () => {
    setViolationsLoading(true);
    try {
      const data = await adminRateLimitsApi.getViolations(10, violationsPage * 10);
      setViolations(data.violations);
      setTotalViolations(data.total_violations);
    } catch (error) {
      console.error('Failed to fetch violations:', error);
      toast({ title: 'Failed to load violations', variant: 'destructive' });
    } finally {
      setViolationsLoading(false);
    }
  };

  const fetchReportSettings = async () => {
    setReportSettingsLoading(true);
    try {
      const settings = await adminPortfolioReportsApi.getSettings();
      setReportSettings(settings);
    } catch (error) {
      console.error('Failed to fetch report settings:', error);
    } finally {
      setReportSettingsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await adminActivityLogsApi.getLogs(20, logsPage * 20);
      setActivityLogs(data.logs);
      setTotalLogs(data.total_logs);
    } catch (error: any) {
      console.error('Failed to fetch activity logs:', error);
      toast({ title: 'Failed to load activity logs', description: error?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setLogsLoading(false);
    }
  };

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats();
      fetchUsers();
      fetchRateLimits();
      fetchViolations();
      fetchReportSettings();
      fetchActivityLogs();
      fetchPromptActivity();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchUsers();
  }, [isAuthenticated, userPage]);

  useEffect(() => {
    if (isAuthenticated) fetchViolations();
  }, [isAuthenticated, violationsPage]);

  useEffect(() => {
    if (isAuthenticated) fetchActivityLogs();
  }, [isAuthenticated, logsPage]);

  // ==================== HANDLERS ====================

  const handleLogout = () => {
    localStorage.removeItem('kubera-admin-token');
    localStorage.removeItem('kubera-admin');
    setIsAuthenticated(false);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    setActionLoading(userId);
    try {
      if (currentStatus === 'active') {
        await adminUsersApi.deactivateUser(userId, 'Deactivated by admin');
      } else {
        await adminUsersApi.reactivateUser(userId);
      }

      setUsers(prev =>
        prev.map(user =>
          user.user_id === userId
            ? { ...user, account_status: currentStatus === 'active' ? 'deactivated' : 'active' }
            : user
        )
      );

      toast({
        title: 'User status updated',
        description: `User has been ${currentStatus === 'active' ? 'deactivated' : 'reactivated'}.`,
      });

      fetchDashboardStats();
    } catch (error) {
      console.error('Failed to update user status:', error);
      toast({ title: 'Failed to update user', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveRateLimits = async () => {
    setRateLimitSaving(true);
    try {
      await adminRateLimitsApi.updateGlobal({
        burst_limit_per_minute: rateLimits.burst,
        per_chat_limit: rateLimits.perChat,
        per_hour_limit: rateLimits.hourly,
        per_day_limit: rateLimits.daily,
      });
      toast({ title: 'Rate limits saved' });
      fetchRateLimits();
    } catch (error) {
      console.error('Failed to save rate limits:', error);
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setRateLimitSaving(false);
    }
  };

  // Helper to get user_id from username
  const getUserIdFromUsername = (username: string): string | null => {
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    return user?.user_id || null;
  };

  // Helper to get username from user_id
  const getUsernameFromId = (userId: string): string => {
    const user = users.find(u => u.user_id === userId);
    return user?.username || userId.substring(0, 8) + '...';
  };

  const handleAddToWhitelist = async () => {
    if (!targetUsername.trim()) return;

    const userId = getUserIdFromUsername(targetUsername);
    if (!userId) {
      toast({ title: 'User not found', description: `No user with username "${targetUsername}" exists.`, variant: 'destructive' });
      return;
    }

    setWhitelistLoading(true);
    try {
      await adminRateLimitsApi.addToWhitelist(userId);
      toast({ title: 'User added to whitelist', description: `@${targetUsername} now has unlimited access.` });
      setTargetUsername('');
      fetchRateLimits();
    } catch (error: any) {
      console.error('Failed to add to whitelist:', error);
      toast({ title: 'Failed to add user', description: error?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleRemoveFromWhitelist = async (userId: string) => {
    try {
      await adminRateLimitsApi.removeFromWhitelist(userId);
      toast({ title: 'User removed from whitelist' });
      fetchRateLimits();
    } catch (error) {
      console.error('Failed to remove from whitelist:', error);
      toast({ title: 'Failed to remove user', variant: 'destructive' });
    }
  };

  const handleResetUserLimits = async (userId: string) => {
    try {
      await adminRateLimitsApi.resetUserLimits(userId);
      toast({ title: 'User rate limits reset' });
    } catch (error) {
      console.error('Failed to reset limits:', error);
      toast({ title: 'Failed to reset limits', variant: 'destructive' });
    }
  };

  const handleSaveUserRateLimits = async (userId: string) => {
    // Build limits object with only non-zero values (backend requires > 0)
    const limits: Record<string, number> = {};
    if (userRateLimits.burst > 0) limits.burst_limit_per_minute = userRateLimits.burst;
    if (userRateLimits.perChat > 0) limits.per_chat_limit = userRateLimits.perChat;
    if (userRateLimits.hourly > 0) limits.per_hour_limit = userRateLimits.hourly;
    if (userRateLimits.daily > 0) limits.per_day_limit = userRateLimits.daily;

    if (Object.keys(limits).length === 0) {
      toast({ title: 'No limits set', description: 'Please enter at least one value greater than 0.', variant: 'destructive' });
      return;
    }

    setUserRateLimitSaving(true);
    try {
      // If user is in whitelist, remove them first (setting limits means they shouldn't be whitelisted)
      const wasWhitelisted = rateLimitConfig?.whitelisted_users?.includes(userId);
      if (wasWhitelisted) {
        await adminRateLimitsApi.removeFromWhitelist(userId);
      }

      await adminRateLimitsApi.setUserLimits(userId, limits);

      // Build specific success message
      const limitDetails = Object.entries(limits)
        .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`)
        .join(', ');

      toast({
        title: 'Rate limits saved successfully',
        description: wasWhitelisted
          ? `Removed from whitelist. Applied limits: ${limitDetails}`
          : `Applied limits: ${limitDetails}`
      });
      fetchRateLimits(); // Refresh to show updated whitelist
    } catch (error: any) {
      console.error('Failed to save user limits:', error);
      toast({ title: 'Failed to save user limits', description: error?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setUserRateLimitSaving(false);
    }
  };

  const handleSaveReportSettings = async () => {
    if (!reportSettings) return;
    setReportSaving(true);
    try {
      await adminPortfolioReportsApi.updateSettings({
        frequency: reportSettings.frequency,
        send_time: reportSettings.send_time,
        send_day_weekly: reportSettings.send_day_weekly,
        send_day_monthly: reportSettings.send_day_monthly,
      });
      toast({ title: 'Report settings saved' });
      fetchReportSettings();
    } catch (error) {
      console.error('Failed to save report settings:', error);
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setReportSaving(false);
    }
  };

  const handleSystemControl = async (action: 'stop' | 'start' | 'restart') => {
    setSystemControlLoading(action);
    try {
      await adminSystemApi.control(action, `System ${action} by admin`);
      toast({ title: `System ${action} successful` });
      fetchDashboardStats();
    } catch (error) {
      console.error(`Failed to ${action} system:`, error);
      toast({ title: `Failed to ${action} system`, variant: 'destructive' });
    } finally {
      setSystemControlLoading(null);
    }
  };

  const handleRefreshAll = () => {
    fetchDashboardStats();
    fetchUsers();
    fetchRateLimits();
    fetchViolations();
    fetchReportSettings();
    fetchActivityLogs();
    fetchPromptActivity();
  };

  const handlePeriodChange = (newPeriod: '24h' | '7d' | '30d') => {
    setPromptActivityPeriod(newPeriod);
    fetchPromptActivity(newPeriod);
  };

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  // Chart data with custom colors
  const userStatusData = stats ? [
    { name: 'Active', value: stats.active_users || 0, color: '#72E3AD' },
    { name: 'Deactivated', value: stats.deactivated_users || 0, color: 'rgba(249, 56, 56, 0.96)' },
  ] : [];

  const promptsData = stats ? [
    { name: 'Today', value: stats.total_prompts_today || 0 },
    { name: 'This Week', value: stats.total_prompts_this_week || 0 },
    { name: 'This Month', value: stats.total_prompts_this_month || 0 },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="brand-text text-xl tracking-widest">
              KUBERA
            </Link>
            <Badge variant="secondary" className="text-xs">ADMIN</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleRefreshAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="ratelimits" className="gap-2">
              <Shield className="h-4 w-4" />
              Rate Limits
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* ==================== OVERVIEW TAB ==================== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Users"
                value={statsLoading ? '...' : (stats?.total_users?.toLocaleString() || '0')}
                icon={<Users className="h-4 w-4" />}
                subtitle={`${stats?.active_users || 0} active`}
              />
              <StatCard
                title="Total Messages"
                value={statsLoading ? '...' : (stats?.total_messages?.toLocaleString() || '0')}
                icon={<MessageSquare className="h-4 w-4" />}
                subtitle="all time"
              />
              <StatCard
                title="Prompts Today"
                value={statsLoading ? '...' : (stats?.total_prompts_today?.toLocaleString() || '0')}
                icon={<Activity className="h-4 w-4" />}
                subtitle={`${stats?.total_prompts_this_week || 0} this week`}
              />
              <StatCard
                title="Violations Today"
                value={statsLoading ? '...' : (stats?.violations_today?.toLocaleString() || '0')}
                icon={<AlertTriangle className="h-4 w-4" />}
                subtitle={`${stats?.total_rate_limit_violations || 0} total`}
                negative
              />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
              {/* User Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>User Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {userStatusData.length > 0 && userStatusData.some(d => d.value > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={userStatusData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                          >
                            {userStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                            ))}
                          </Pie>
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No user data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Prompt Activity Line Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Prompt Activity</CardTitle>
                  <Select value={promptActivityPeriod} onValueChange={(v) => handlePeriodChange(v as '24h' | '7d' | '30d')}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {promptActivityLoading ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Loading...
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={promptActivityData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--muted-foreground))"
                            opacity={0.15}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={promptActivityPeriod === '7d' ? 0 : -45}
                            textAnchor={promptActivityPeriod === '7d' ? 'middle' : 'end'}
                            height={promptActivityPeriod === '7d' ? 30 : 50}
                          />
                          <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '4px',
                              padding: '8px 12px',
                              fontSize: '12px',
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="hsl(var(--foreground))"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: 'hsl(var(--foreground))' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={stats?.system_status === 'running' ? 'default' : 'destructive'}>
                      {stats?.system_status || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Active Users</span>
                    <span className="font-medium">{stats?.active_users || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Prompts/Month</span>
                    <span className="font-medium">{stats?.total_prompts_this_month || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Report Schedule</span>
                    <span className="font-medium capitalize">{stats?.portfolio_report_frequency || 'disabled'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== USERS TAB ==================== */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>User Management</span>
                  <span className="text-sm font-normal text-muted-foreground">{totalUsers} total</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead className="text-center">Chats</TableHead>
                          <TableHead className="text-center">Prompts</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell className="text-muted-foreground">@{user.username}</TableCell>
                            <TableCell className="text-center">{user.total_chats}</TableCell>
                            <TableCell className="text-center">{user.total_prompts}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={user.account_status === 'active' ? 'default' : 'destructive'}>
                                {user.account_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => fetchUserDetail(user.user_id)}
                                  disabled={userDetailLoading}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Switch
                                  checked={user.account_status === 'active'}
                                  disabled={actionLoading === user.user_id}
                                  onCheckedChange={() => handleToggleUserStatus(user.user_id, user.account_status)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {Math.ceil(totalUsers / USERS_PER_PAGE) > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-muted-foreground">
                          Page {userPage + 1} of {Math.ceil(totalUsers / USERS_PER_PAGE)}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.max(0, p - 1))} disabled={userPage === 0}>
                            <ChevronLeft className="h-4 w-4" /> Previous
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setUserPage(p => p + 1)} disabled={(userPage + 1) * USERS_PER_PAGE >= totalUsers}>
                            Next <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== RATE LIMITS TAB ==================== */}
          <TabsContent value="ratelimits" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Global Rate Limits */}
              <Card>
                <CardHeader>
                  <CardTitle>Global Rate Limits</CardTitle>
                  <CardDescription>Default limits for all users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rateLimitLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Loading...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Burst (per min)</label>
                          <Input type="number" value={rateLimits.burst} onChange={(e) => setRateLimits({ ...rateLimits, burst: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Per Chat</label>
                          <Input type="number" value={rateLimits.perChat} onChange={(e) => setRateLimits({ ...rateLimits, perChat: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Hourly</label>
                          <Input type="number" value={rateLimits.hourly} onChange={(e) => setRateLimits({ ...rateLimits, hourly: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Daily</label>
                          <Input type="number" value={rateLimits.daily} onChange={(e) => setRateLimits({ ...rateLimits, daily: parseInt(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <Button onClick={handleSaveRateLimits} className="w-full" disabled={rateLimitSaving}>
                        {rateLimitSaving ? 'Saving...' : 'Save Rate Limits'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Whitelist */}
              <Card>
                <CardHeader>
                  <CardTitle>Whitelisted Users</CardTitle>
                  <CardDescription>Users with unlimited access</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Enter username (e.g. john_doe)" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} />
                    <Button onClick={handleAddToWhitelist} disabled={whitelistLoading}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {rateLimitConfig?.whitelisted_users && rateLimitConfig.whitelisted_users.length > 0 ? (
                    <div className="space-y-2">
                      {rateLimitConfig.whitelisted_users.map((userId) => (
                        <div key={userId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm font-medium">@{getUsernameFromId(userId)}</span>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveFromWhitelist(userId)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">No whitelisted users</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* User-Specific Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle>User-Specific Rate Limits</CardTitle>
                <CardDescription>Set custom rate limits for a specific user</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter username (e.g. john_doe)"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Burst (per min)</label>
                    <Input
                      type="number"
                      placeholder="0 = default"
                      value={userRateLimits.burst || ''}
                      onChange={(e) => setUserRateLimits({ ...userRateLimits, burst: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Per Chat</label>
                    <Input
                      type="number"
                      placeholder="0 = default"
                      value={userRateLimits.perChat || ''}
                      onChange={(e) => setUserRateLimits({ ...userRateLimits, perChat: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hourly</label>
                    <Input
                      type="number"
                      placeholder="0 = default"
                      value={userRateLimits.hourly || ''}
                      onChange={(e) => setUserRateLimits({ ...userRateLimits, hourly: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Daily</label>
                    <Input
                      type="number"
                      placeholder="0 = default"
                      value={userRateLimits.daily || ''}
                      onChange={(e) => setUserRateLimits({ ...userRateLimits, daily: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const userId = getUserIdFromUsername(targetUsername);
                      if (userId) handleSaveUserRateLimits(userId);
                      else toast({ title: 'User not found', description: `No user with username "${targetUsername}" exists.`, variant: 'destructive' });
                    }}
                    className="flex-1"
                    disabled={userRateLimitSaving || !targetUsername.trim()}
                  >
                    {userRateLimitSaving ? 'Saving...' : 'Save User Rate Limits'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const userId = getUserIdFromUsername(targetUsername);
                      if (userId) handleResetUserLimits(userId);
                      else toast({ title: 'User not found', description: `No user with username "${targetUsername}" exists.`, variant: 'destructive' });
                    }}
                    disabled={!targetUsername.trim()}
                  >
                    <RotateCw className="h-4 w-4 mr-2" /> Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Violations Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Rate Limit Violations</span>
                  <span className="text-sm font-normal text-muted-foreground">{totalViolations} total</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {violationsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : violations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No violations found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Limit</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-center">Reset</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violations.map((v) => (
                        <TableRow key={v.violation_id}>
                          <TableCell className="text-muted-foreground">{v.user_email}</TableCell>
                          <TableCell><Badge variant="outline">{v.violation_type}</Badge></TableCell>
                          <TableCell>{v.limit_value}</TableCell>
                          <TableCell className="text-destructive">{v.prompts_used}</TableCell>
                          <TableCell>{v.action_taken}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(v.violated_at).toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleResetUserLimits(v.user_id)}>
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== SYSTEM TAB ==================== */}
          <TabsContent value="system" className="space-y-6">
            {/* System Control */}
            <Card>
              <CardHeader>
                <CardTitle>System Control</CardTitle>
                <CardDescription>Control the chatbot system status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button onClick={() => handleSystemControl('start')} disabled={systemControlLoading !== null} className="flex-1">
                    {systemControlLoading === 'start' ? 'Starting...' : <><Play className="h-4 w-4 mr-2" /> Start</>}
                  </Button>
                  <Button onClick={() => handleSystemControl('stop')} variant="destructive" disabled={systemControlLoading !== null} className="flex-1">
                    {systemControlLoading === 'stop' ? 'Stopping...' : <><Power className="h-4 w-4 mr-2" /> Stop</>}
                  </Button>
                  <Button onClick={() => handleSystemControl('restart')} variant="outline" disabled={systemControlLoading !== null} className="flex-1">
                    {systemControlLoading === 'restart' ? 'Restarting...' : <><RotateCcw className="h-4 w-4 mr-2" /> Restart</>}
                  </Button>
                </div>

                {/* Description Box */}
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                  <p className="font-medium text-foreground">What does this control?</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><span className="font-medium text-destructive">Stop:</span> Blocks users from sending chat prompts (maintenance mode)</li>
                    <li><span className="font-medium text-green-600">Start:</span> Resumes normal chat operations</li>
                    <li><span className="font-medium text-blue-600">Restart:</span> Refreshes the system status</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    <strong>Note:</strong> This only affects the AI chat feature. Users can still access their portfolios,
                    profiles, and create new chats - but cannot send prompts when stopped. Admin operations remain unaffected.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Activity Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Admin Activity Logs</span>
                  <span className="text-sm font-normal text-muted-foreground">{totalLogs} total</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No activity logs</div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admin</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs.map((log) => (
                          <TableRow key={log.log_id}>
                            <TableCell>{log.admin_email}</TableCell>
                            <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{log.target_type}: {log.target_id?.slice(0, 8)}...</TableCell>
                            <TableCell className="text-muted-foreground">{new Date(log.performed_at).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {Math.ceil(totalLogs / 20) > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-muted-foreground">Page {logsPage + 1} of {Math.ceil(totalLogs / 20)}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setLogsPage(p => Math.max(0, p - 1))} disabled={logsPage === 0}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setLogsPage(p => p + 1)} disabled={(logsPage + 1) * 20 >= totalLogs}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== REPORTS TAB ==================== */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Report Settings</CardTitle>
                <CardDescription>Configure automatic portfolio report emails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {reportSettingsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : reportSettings ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Frequency</label>
                        <Select value={reportSettings.frequency} onValueChange={(v) => setReportSettings({ ...reportSettings, frequency: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disabled">Disabled</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Send Time</label>
                        <Input type="time" value={reportSettings.send_time} onChange={(e) => setReportSettings({ ...reportSettings, send_time: e.target.value })} />
                      </div>
                      {reportSettings.frequency === 'weekly' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Day of Week</label>
                          <Select value={reportSettings.send_day_weekly || '1'} onValueChange={(v) => setReportSettings({ ...reportSettings, send_day_weekly: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sunday</SelectItem>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {reportSettings.frequency === 'monthly' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Day of Month</label>
                          <Input type="number" min={1} max={28} value={reportSettings.send_day_monthly || 1} onChange={(e) => setReportSettings({ ...reportSettings, send_day_monthly: parseInt(e.target.value) || 1 })} />
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Last sent: {reportSettings.last_sent ? new Date(reportSettings.last_sent).toLocaleString() : 'Never'}</span>
                      <span>Next: {reportSettings.next_scheduled ? new Date(reportSettings.next_scheduled).toLocaleString() : 'Not scheduled'}</span>
                    </div>
                    <Button onClick={handleSaveReportSettings} className="w-full" disabled={reportSaving}>
                      {reportSaving ? 'Saving...' : 'Save Report Settings'}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">Failed to load settings</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* User Detail Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Detailed information about this user</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Full Name</span>
                  <p className="font-medium">{selectedUser.full_name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Username</span>
                  <p className="font-medium">@{selectedUser.username}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Email</span>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={selectedUser.account_status === 'active' ? 'default' : 'destructive'}>
                    {selectedUser.account_status}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Chats</span>
                  <p className="font-medium">{selectedUser.total_chats}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Prompts</span>
                  <p className="font-medium">{selectedUser.total_prompts}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Portfolio Entries</span>
                  <p className="font-medium">{selectedUser.total_portfolio_entries}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Rate Limit Violations</span>
                  <p className="font-medium">{selectedUser.rate_limit_violations}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Investment Style</span>
                  <p className="font-medium">{selectedUser.investment_style || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Risk Tolerance</span>
                  <p className="font-medium">{selectedUser.risk_tolerance || 'Not set'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleResetUserLimits(selectedUser.user_id)}>
                  <RotateCw className="h-4 w-4 mr-2" /> Reset Rate Limits
                </Button>
                <Button
                  variant={selectedUser.account_status === 'active' ? 'destructive' : 'default'}
                  className="flex-1"
                  onClick={() => {
                    handleToggleUserStatus(selectedUser.user_id, selectedUser.account_status);
                    setShowUserModal(false);
                  }}
                >
                  {selectedUser.account_status === 'active' ? (
                    <><UserX className="h-4 w-4 mr-2" /> Deactivate</>
                  ) : (
                    <><UserCheck className="h-4 w-4 mr-2" /> Reactivate</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== STAT CARD COMPONENT ====================

function StatCard({
  title,
  value,
  icon,
  subtitle,
  negative,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold">{value}</span>
          {subtitle && (
            <span className={`text-xs font-medium ${negative ? 'text-destructive' : 'text-muted-foreground'}`}>
              {subtitle}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
