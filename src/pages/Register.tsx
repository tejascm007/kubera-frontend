import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { authApi } from '@/lib/api';

type Step = 'email' | 'otp' | 'profile';

export default function Register() {
  const navigate = useNavigate();
  const { registerStep1, registerStep2, registerStep3, registrationStep, pendingEmail, clearRegistrationState } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(600);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync with auth context registration state
  useEffect(() => {
    if (registrationStep === 'email_sent' && pendingEmail) {
      setEmail(pendingEmail);
      setStep('otp');
    } else if (registrationStep === 'otp_verified') {
      setStep('profile');
    }
  }, [registrationStep, pendingEmail]);

  // Countdown timers
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (step === 'otp' && otpExpiry > 0) {
      const timer = setTimeout(() => setOtpExpiry(otpExpiry - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, otpExpiry]);

  // Username availability check
  useEffect(() => {
    const username = formData.username;

    if (!username) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      return;
    }

    const isValidFormat = /^[a-zA-Z0-9_]{3,50}$/.test(username);
    if (!isValidFormat) {
      setUsernameStatus('invalid');
      setUsernameMessage('3-50 alphanumeric characters and underscores only');
      return;
    }

    setUsernameStatus('checking');

    const timer = setTimeout(async () => {
      try {
        const data = await authApi.checkUsername(username);
        if (data.available) {
          setUsernameStatus('available');
          setUsernameMessage('Username available');
        } else {
          setUsernameStatus('taken');
          setUsernameMessage(data.message || 'Username already taken');
        }
      } catch (error) {
        console.error('Username check failed:', error);
        setUsernameStatus('invalid');
        setUsernameMessage('Unable to verify username');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pastedData.split('').forEach((char, idx) => {
      if (idx < 6) newOtp[idx] = char;
    });
    setOtp(newOtp);
    if (pastedData.length === 6) {
      otpRefs.current[5]?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Step 1: Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({ title: 'Error', description: 'Please enter your email', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await registerStep1(email);
      toast({ title: 'OTP Sent', description: 'Check your email for the verification code.' });
      setStep('otp');
      setResendCooldown(60);
      setOtpExpiry(600);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      await registerStep1(email);
      toast({ title: 'OTP Resent', description: 'Check your email for the new code.' });
      setResendCooldown(60);
      setOtpExpiry(600);
      setOtp(['', '', '', '', '', '']);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend OTP.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast({ title: 'Error', description: 'Please enter the 6-digit code', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await registerStep2(otpCode);
      toast({ title: 'Email Verified', description: 'Complete your profile to finish registration.' });
      setStep('profile');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Invalid OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Complete Registration
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.username || !formData.password) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    if (formData.password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    if (usernameStatus !== 'available') {
      toast({ title: 'Error', description: 'Please choose a valid username', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await registerStep3({
        username: formData.username,
        password: formData.password,
        full_name: formData.fullName,
        phone: formData.phone || undefined,
      });

      toast({ title: 'Account created!', description: 'Welcome to KUBERA.' });
      navigate('/chat');
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('email');
      setOtp(['', '', '', '', '', '']);
    } else if (step === 'profile') {
      setStep('otp');
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 py-8">
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {step === 'email' && 'Create your account'}
            {step === 'otp' && 'Verify your email'}
            {step === 'profile' && 'Complete your profile'}
          </CardTitle>
          <CardDescription>
            {step === 'email' && 'Start your investment journey with KUBERA'}
            {step === 'otp' && `Enter the 6-digit code sent to ${email}`}
            {step === 'profile' && 'Just a few more details to get started'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Continue'}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link to="/login" className="font-medium text-foreground hover:underline">Sign in</Link>
              </div>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="text-center text-sm text-muted-foreground">
                Code expires in <span className={otpExpiry < 60 ? 'text-destructive' : ''}>{formatTime(otpExpiry)}</span>
              </div>

              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    disabled={isLoading}
                    className="w-12 h-12 text-center text-xl font-semibold"
                  />
                ))}
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || otp.join('').length !== 6}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify & Continue'}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Change email
              </button>
            </form>
          )}

          {/* Step 3: Profile */}
          {step === 'profile' && (
            <form onSubmit={handleCompleteRegistration} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium">Full Name</label>
                <Input id="fullName" name="fullName" type="text" placeholder="John Doe" value={formData.fullName} onChange={handleChange} disabled={isLoading} />
              </div>

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">Username</label>
                <div className="relative">
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={usernameStatus === 'available' ? 'border-success' : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive' : ''}
                  />
                  {usernameStatus !== 'idle' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {usernameStatus === 'available' && <Check className="h-4 w-4 text-success" />}
                      {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X className="h-4 w-4 text-destructive" />}
                    </div>
                  )}
                </div>
                {usernameMessage && <p className={`text-xs ${usernameStatus === 'available' ? 'text-success' : 'text-destructive'}`}>{usernameMessage}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">Phone (Optional)</label>
                <Input id="phone" name="phone" type="tel" placeholder="+91 9876543210" value={formData.phone} onChange={handleChange} disabled={isLoading} />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={handleChange} disabled={isLoading} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                <Input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} disabled={isLoading} />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || usernameStatus !== 'available'}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create account'}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
