import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

type SignInFormValues = {
  email: string;
  password: string;
};

export default function SignIn() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignInFormValues>();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: SignInFormValues) => {
    setIsLoading(true);

    const { error } = await login(data.email, data.password);

    if (error) {
      setError('root', {
        message: error,
      });
      setIsLoading(false);
    } else {
      // Redirect to home page on success
      navigate('/');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Sign In to SubscriptionTracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {errors.root && (
            <div className="rounded-md bg-red-50 p-3 border border-red-200">
              <p className="text-sm text-red-800">{errors.root.message}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              disabled={isLoading}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              disabled={isLoading}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>

          <Button className="w-full" variant="ghost" disabled={isLoading}>
            Sign Up
          </Button>

        </form>
      </div>
    </main>
  );
}
