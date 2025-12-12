import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { adminAuthApi, setAdminToken } from '@/lib/adminApi';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter your admin email',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await adminAuthApi.sendOTP(email);

      setStep('otp');
      toast({
        title: 'OTP Sent',
        description: response.message || 'Check your email for the verification code.',
      });
    } catch (error: any) {
      console.error('OTP send error:', error);
      toast({
        title: 'Failed to send OTP',
        description: error.message || 'Email not found or not authorized as admin.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast({
        title: 'Error',
        description: 'Please enter a valid 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await adminAuthApi.verifyOTP(email, otp);

      // Store admin token and info
      setAdminToken(response.access_token);
      localStorage.setItem('kubera-admin', JSON.stringify({
        admin_id: response.admin_id,
        email: response.email,
        full_name: response.full_name,
        is_super_admin: response.is_super_admin,
      }));

      toast({
        title: `Welcome, ${response.full_name || 'Admin'}`,
        description: 'You have successfully logged in.',
      });

      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error('OTP verify error:', error);
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired OTP.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-accent/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-md bg-foreground text-background flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>
            {step === 'email'
              ? 'Enter your admin email to receive a verification code'
              : 'Enter the 6-digit code sent to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Admin Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@kubera.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">
                  Verification Code
                </label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Login'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep('email')}
                disabled={isLoading}
              >
                Back to email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
