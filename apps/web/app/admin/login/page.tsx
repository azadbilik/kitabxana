'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/styles/admin.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? 'Giriş uğursuz oldu');
        setLoading(false);
        return;
      }

      const { accessToken, refreshToken } = await res.json();
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      window.location.href = '/admin';
    } catch {
      setError('Server ilə əlaqə yoxdur');
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: '320px',
        padding: '2rem',
        background: 'var(--surf)',
        border: '1px solid var(--rule)',
        borderRadius: '4px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{
            margin: 0,
            lineHeight: 1.2,
            fontFamily: 'var(--font-serif)',
            fontSize: '1.4rem',
            fontWeight: 900,
            letterSpacing: '-0.02em',
          }}>
            Kitabxana<span style={{ color: 'var(--pomeg)' }}>◆</span>AZ
          </h1>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginTop: '0.25rem',
          }}>
            Admin Panel
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: '0.5rem 0.75rem',
            borderRadius: '3px',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        <div className="adm-field">
          <label className="adm-label" htmlFor="adm-login-1">E-poçt</label>
          <input id="adm-login-1"
            className="adm-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="adm-field">
          <label className="adm-label" htmlFor="adm-login-2">Şifrə</label>
          <input id="adm-login-2"
            className="adm-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="adm-btn adm-btn-pom"
          disabled={loading}
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          {loading ? 'Giriş edilir...' : 'Daxil ol'}
        </button>
      </form>
    </main>
  );
}
