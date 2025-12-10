import React, { useState } from 'react';
import { useAuth } from './useAuth';
import { useNavigate } from '../../shared/hooks/useNavigate';

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo = '/dashboard' }: LoginFormProps) {
  const { login, loginWithSSO, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      onSuccess?.();
      navigate(redirectTo);
    } catch {
      // Error is handled by context
    }
  };

  const handleSSOLogin = async (provider: string) => {
    try {
      await loginWithSSO(provider);
      onSuccess?.();
      navigate(redirectTo);
    } catch {
      // Error is handled by context
    }
  };

  return (
    <div className="login-form">
      <h2>Sign in to your account</h2>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-password"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="form-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <a href="/forgot-password" className="forgot-password">
            Forgot password?
          </a>
        </div>

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="divider">
        <span>Or continue with</span>
      </div>

      <div className="sso-buttons">
        <button
          type="button"
          onClick={() => handleSSOLogin('google')}
          className="btn-sso"
          disabled={isLoading}
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => handleSSOLogin('github')}
          className="btn-sso"
          disabled={isLoading}
        >
          GitHub
        </button>
        <button
          type="button"
          onClick={() => handleSSOLogin('microsoft')}
          className="btn-sso"
          disabled={isLoading}
        >
          Microsoft
        </button>
      </div>

      <p className="signup-link">
        Don't have an account? <a href="/register">Sign up</a>
      </p>
    </div>
  );
}
