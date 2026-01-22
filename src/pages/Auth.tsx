import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Mail, Lock, User, ArrowRight, Phone, Clock } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phoneNumber: z.string().min(10, 'Please enter a valid phone number').optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; phoneNumber?: string }>({});
  const [showPendingMessage, setShowPendingMessage] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { signIn, signUp, signOut, resetPassword, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.is_approved) {
        navigate('/dashboard');
      } else {
        setShowPendingMessage(true);
      }
    }
  }, [user, profile, loading, navigate]);

  const validateForm = () => {
    try {
      if (isLogin) {
        authSchema.pick({ email: true, password: true }).parse({ email, password });
      } else {
        authSchema.parse({ email, password, fullName, phoneNumber });
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string; fullName?: string; phoneNumber?: string } = {};
        err.errors.forEach((error) => {
          const field = error.path[0] as string;
          fieldErrors[field as keyof typeof fieldErrors] = error.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !z.string().email().safeParse(email).success) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    
    setIsLoading(true);
    setErrors({});

    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: 'Email Sent',
          description: 'Check your inbox for the password reset link.',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Login Failed',
            description: error.message === 'Invalid login credentials' 
              ? 'Invalid email or password. Please try again.'
              : error.message,
            variant: 'destructive',
          });
        }
        // Navigation is handled by useEffect based on approval status
      } else {
        const { error } = await signUp(email, password, fullName, phoneNumber);
        if (error) {
          toast({
            title: 'Sign Up Failed',
            description: error.message.includes('already registered')
              ? 'This email is already registered. Please login instead.'
              : error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Account Created!',
            description: 'Your account is pending admin approval.',
          });
          setShowPendingMessage(true);
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show pending approval message
  if (showPendingMessage) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="glass-card glow-border p-8 animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-warning/10 border border-warning/20 mb-6">
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Account Pending Approval</h2>
            <p className="text-muted-foreground mb-6">
              Your account has been created and is currently awaiting admin approval. 
              You will be able to access the platform once an administrator reviews and approves your account.
            </p>
            <div className="bg-secondary/30 rounded-lg p-4 text-left space-y-2 mb-6">
              <p><span className="text-muted-foreground">Email:</span> {email || profile?.email}</p>
              <p><span className="text-muted-foreground">Name:</span> {fullName || profile?.full_name}</p>
            </div>
            <Button 
              variant="outline" 
              onClick={async () => {
                await signOut();
                setShowPendingMessage(false);
                setEmail('');
                setPassword('');
                setFullName('');
                setPhoneNumber('');
              }}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot Password Form
  if (isForgotPassword) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gradient">Reset Password</h1>
            <p className="text-muted-foreground mt-2">Enter your email to receive a reset link</p>
          </div>

          <div className="glass-card glow-border p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {resetEmailSent ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 mb-2">
                  <Mail className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Check Your Email</h3>
                <p className="text-muted-foreground text-sm">
                  We've sent a password reset link to <span className="text-foreground font-medium">{email}</span>
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetEmailSent(false);
                    setEmail('');
                  }}
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setErrors({});
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to Login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-4xl font-black text-gradient">CF</span>
            <span className="text-3xl font-bold text-muted-foreground">SMS</span>
          </div>
          <p className="text-muted-foreground mt-2">CloudFlare Bulk SMS Platform</p>
        </div>

        {/* Auth Card */}
        <div className="glass-card glow-border p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex gap-2 mb-6">
            <Button
              variant={isLogin ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setIsLogin(true)}
            >
              Login
            </Button>
            <Button
              variant={!isLogin ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.fullName && <p className="text-destructive text-sm">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-foreground">Contact Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="+1234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.phoneNumber && <p className="text-destructive text-sm">{errors.phoneNumber}</p>}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
              {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
              {errors.password && <p className="text-destructive text-sm">{errors.password}</p>}
            </div>

            {isLogin && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                'Please wait...'
              ) : (
                <>
                  {isLogin ? 'Login' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6 text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <a href="/" className="text-primary hover:underline">
            ← Back to Home
          </a>
        </p>
      </div>
    </div>
  );
}
