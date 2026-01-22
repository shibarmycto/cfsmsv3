import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user arrived via password reset link
    if (!session) {
      // Give Supabase a moment to process the recovery token
      const timeout = setTimeout(() => {
        if (!session) {
          toast({
            title: 'Invalid or expired link',
            description: 'Please request a new password reset link.',
            variant: 'destructive',
          });
          navigate('/auth');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [session, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      passwordSchema.parse({ password, confirmPassword });
      setErrors({});
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: { password?: string; confirmPassword?: string } = {};
        err.errors.forEach((error) => {
          const field = error.path[0] as string;
          fieldErrors[field as keyof typeof fieldErrors] = error.message;
        });
        setErrors(fieldErrors);
      }
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setIsSuccess(true);
        toast({
          title: 'Password Updated',
          description: 'Your password has been successfully updated.',
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

  if (isSuccess) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="glass-card glow-border p-8 animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Password Updated!</h2>
            <p className="text-muted-foreground mb-6">
              Your password has been successfully changed. You can now login with your new password.
            </p>
            <Button 
              variant="hero" 
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              Go to Login
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-4xl font-black text-gradient">CF</span>
            <span className="text-3xl font-bold text-muted-foreground">SMS</span>
          </div>
          <h1 className="text-2xl font-bold mt-4">Set New Password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password below</p>
        </div>

        <div className="glass-card glow-border p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">New Password</Label>
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
              {errors.confirmPassword && <p className="text-destructive text-sm">{errors.confirmPassword}</p>}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <a href="/auth" className="text-primary hover:underline">
            ← Back to Login
          </a>
        </p>
      </div>
    </div>
  );
}
