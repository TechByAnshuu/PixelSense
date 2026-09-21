import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut } from 'aws-amplify/auth';

import Login      from './auth/Login';
import Signup     from './auth/Signup';
import UploadForm from './upload/UploadForm';
import ResultView from './results/ResultView';
import HistoryList from './results/HistoryList';

// ── Protected route wrapper ────────────────────────────────
function RequireAuth({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'auth' | 'guest'

  useEffect(() => {
    getCurrentUser()
      .then(() => setStatus('auth'))
      .catch(() => setStatus('guest'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="full-screen-center">
        <span className="spinner large" aria-label="Checking authentication…" />
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/login" replace />;
  return children;
}

// ── Top Navigation Bar ─────────────────────────────────────
function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <nav className="app-navbar" role="navigation" aria-label="Main navigation">
      <Link to="/upload" className="navbar-brand">
        <span className="nav-logo-mark">PS</span>
        <span className="nav-logo-text">Pixel<span>Sense</span></span>
      </Link>
      <div className="navbar-links">
        <Link to="/upload"  className="nav-link">Upload</Link>
        <Link to="/history" className="nav-link">History</Link>
      </div>
      <div className="navbar-actions">
        <span className="nav-email">{user.signInDetails?.loginId || ''}</span>
        <button onClick={handleSignOut} className="btn-ghost">Sign Out</button>
      </div>
    </nav>
  );
}

// ── App root ───────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected */}
          <Route path="/upload" element={<RequireAuth><UploadForm /></RequireAuth>} />
          <Route path="/results/:imageId" element={<RequireAuth><ResultView /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryList /></RequireAuth>} />

          {/* Default */}
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
