import React, { useState } from 'react';
import { signUp, confirmSignUp } from 'aws-amplify/auth';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const navigate = useNavigate();
  const [step,     setStep]     = useState('signup'); // 'signup' | 'confirm'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code,     setCode]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      setStep('confirm');
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-mark">PS</span>
          <span className="auth-logo-text">Pixel<span>Sense</span></span>
        </div>

        {step === 'signup' ? (
          <>
            <h1 className="auth-title">Create account</h1>
            <p className="auth-sub">Start analyzing images with AI</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSignup} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="signup-password">Password <span className="hint">(min 8 chars, 1 number, 1 uppercase)</span></label>
                <input
                  id="signup-password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="spinner" aria-hidden="true" /> : null}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
            <p className="auth-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-sub">We sent a 6-digit code to <strong>{email}</strong></p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleConfirm} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="confirm-code">Verification Code</label>
                <input
                  id="confirm-code" type="text" value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456" required maxLength={6}
                  inputMode="numeric" pattern="\d{6}"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="spinner" aria-hidden="true" /> : null}
                {loading ? 'Verifying…' : 'Verify Email'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
