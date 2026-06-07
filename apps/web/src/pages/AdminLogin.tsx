import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  CircleNotch,
  ArrowLeft,
  ArrowRight,
  Warning,
} from '@phosphor-icons/react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: fd.get('username'),
          password: fd.get('password'),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error?.message || d.message || '登录失败');
      }
      const { token } = await r.json();
      localStorage.setItem('admin_token', token);
      navigate('/admin');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative">
      <Link
        to="/"
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-primary transition-colors group"
      >
        <ArrowLeft
          size={13}
          weight="bold"
          className="group-hover:-translate-x-0.5 transition-transform duration-200"
        />
        返回站点
      </Link>

      <form onSubmit={onSubmit} className="w-full max-w-sm" noValidate>
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="bezel-shell">
            <div className="bezel-core">
              <div className="w-12 h-12 rounded-xl bg-ink-primary flex items-center justify-center text-base font-semibold text-bg-surface">
                S
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="smallcaps mb-2">管理员</p>
            <h1 className="font-serif text-2xl tracking-tight">登录后台</h1>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="admin-username" className="sr-only">
              账号
            </label>
            <input
              id="admin-username"
              name="username"
              required
              placeholder="账号"
              className="input"
              autoComplete="username"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'admin-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="sr-only">
              密码
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              placeholder="密码"
              className="input"
              autoComplete="current-password"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'admin-error' : undefined}
            />
          </div>
          {error && (
            <div
              id="admin-error"
              role="alert"
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-accent-pale-red-bg text-accent-pale-red-fg text-xs leading-relaxed animate-scale-in"
            >
              <Warning
                size={14}
                weight="bold"
                className="flex-shrink-0 mt-0.5"
              />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full group"
          >
            {loading ? (
              <CircleNotch size={14} weight="bold" className="animate-spin" />
            ) : (
              <>
                <Lock size={13} weight="bold" />
                登录
                <span className="btn-icon-nest">
                  <ArrowRight size={11} weight="bold" />
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
