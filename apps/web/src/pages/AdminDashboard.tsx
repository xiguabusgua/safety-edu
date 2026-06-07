import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import type { AdminStats, AdminTask } from 'shared-types';
import {
  SignOut,
  MapPin,
  Users,
  TrendUp,
  Warning,
  ChartLine,
  Buildings,
  ListChecks,
} from '@phosphor-icons/react';
import Reveal from '../components/Reveal';
import { Skeleton } from '../components/Skeleton';

export default function AdminDashboard() {
  const token = localStorage.getItem('admin_token');
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [filter, setFilter] = useState<{ status?: string; platform?: string }>(
    {},
  );

  useEffect(() => {
    if (!token) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [token, filter]);

  async function load() {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.platform) params.set('platform', filter.platform);
    const [t, s] = await Promise.all([
      fetch(`/api/admin/tasks?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ]);
    setTasks(t.tasks || []);
    setStats(s);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  }

  if (!token) return <Navigate to="/admin/login" replace />;
  if (!stats) return <AdminDashboardSkeleton />;

  const maxProvince = Math.max(...stats.byProvince.map((p) => p.count), 1);
  const maxSchool = Math.max(...stats.bySchool.map((p) => p.count), 1);

  return (
    <main className="min-h-[100dvh] max-w-6xl mx-auto px-6 py-12 md:py-16">
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-6">
          <Link to="/admin" className="flex items-center gap-2 group">
            <span className="w-7 h-7 rounded-md bg-ink-primary flex items-center justify-center text-[11px] font-semibold text-bg-surface group-hover:rotate-[-4deg] transition-transform duration-200">
              S
            </span>
            <span className="text-sm font-medium tracking-tight">
              safety edu · admin
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-pale-green-fg animate-pulse" />
            每 5 秒自动刷新
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn-ghost text-sm">
            站点
          </Link>
          <Link to="/admin/questions" className="btn-ghost text-sm">
            题库
          </Link>
          <button onClick={logout} className="btn-ghost text-sm">
            <SignOut size={13} weight="bold" />
            退出
          </button>
        </div>
      </header>

      {/* 顶部统计 — Double-Bezel 套 */}
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard
            label="总用户"
            value={stats.uniqueUsers}
            icon={<Users size={13} weight="bold" />}
          />
          <StatCard label="总任务" value={stats.total} />
          <StatCard label="今日单数" value={stats.todayCount} />
          <StatCard
            label="总收入"
            value={`¥${stats.revenue}`}
            icon={<TrendUp size={13} weight="bold" />}
            accent="success"
          />
          <StatCard
            label="失败"
            value={stats.failed}
            danger
            icon={<Warning size={13} weight="bold" />}
          />
        </div>
      </Reveal>

      {/* 平台 / 状态 分布 */}
      <Reveal delay={80}>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bezel-shell">
            <div className="bezel-core">
              <div className="card">
                <div className="flex items-center gap-2 mb-5">
                  <ChartLine
                    size={13}
                    weight="bold"
                    className="text-ink-secondary"
                  />
                  <h2 className="text-sm font-medium">平台分布</h2>
                </div>
                {stats.byPlatform.map((b) => (
                  <div key={b.platform} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-ink-secondary">
                        {b.platform === 'weban' ? '安全微伴' : '江苏安全通'}
                      </span>
                      <span className="font-mono tabular-nums text-ink-primary">
                        {b.count} 单 · ¥{b.revenue}
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-pill overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                          b.platform === 'weban'
                            ? 'bg-accent-pale-blue-fg'
                            : 'bg-accent-pale-yellow-fg'
                        }`}
                        style={{ width: `${(b.count / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bezel-shell">
            <div className="bezel-core">
              <div className="card">
                <div className="flex items-center gap-2 mb-5">
                  <ListChecks
                    size={13}
                    weight="bold"
                    className="text-ink-secondary"
                  />
                  <h2 className="text-sm font-medium">任务状态</h2>
                </div>
                {stats.byStatus.map((b) => (
                  <div
                    key={b.status}
                    className="flex items-center justify-between text-sm py-1.5"
                  >
                    <StatusBadge status={b.status} />
                    <span className="font-mono tabular-nums text-ink-primary">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* 地区分布 */}
      <Reveal delay={140}>
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bezel-shell">
            <div className="bezel-core">
              <div className="card">
                <div className="flex items-center gap-2 mb-5">
                  <MapPin
                    size={13}
                    weight="bold"
                    className="text-ink-secondary"
                  />
                  <h2 className="text-sm font-medium">地区分布</h2>
                </div>
                {stats.byProvince.length === 0 ? (
                  <p className="text-xs text-ink-muted">暂无数据</p>
                ) : (
                  <div className="space-y-2">
                    {stats.byProvince.slice(0, 10).map((p) => (
                      <div key={p.province}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-ink-secondary">{p.province}</span>
                          <span className="font-mono tabular-nums">{p.count}</span>
                        </div>
                        <div className="h-1 bg-bg-elevated rounded-pill overflow-hidden">
                          <div
                            className="h-full bg-accent-pale-green-fg transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                            style={{
                              width: `${(p.count / maxProvince) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bezel-shell">
            <div className="bezel-core">
              <div className="card">
                <div className="flex items-center gap-2 mb-5">
                  <Buildings
                    size={13}
                    weight="bold"
                    className="text-ink-secondary"
                  />
                  <h2 className="text-sm font-medium">学校 TOP 10</h2>
                </div>
                {stats.bySchool.length === 0 ? (
                  <p className="text-xs text-ink-muted">暂无数据</p>
                ) : (
                  <div className="space-y-2">
                    {stats.bySchool.slice(0, 10).map((s) => (
                      <div key={s.school}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-ink-secondary truncate flex-1">
                            {s.school}
                          </span>
                          <span className="font-mono tabular-nums ml-2">
                            {s.count}
                          </span>
                        </div>
                        <div className="h-1 bg-bg-elevated rounded-pill overflow-hidden">
                          <div
                            className="h-full bg-accent-pale-blue-fg transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                            style={{ width: `${(s.count / maxSchool) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* 任务列表 */}
      <Reveal delay={200}>
        <div className="card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-medium">任务流水</h2>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={filter.platform ?? ''}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  platform: e.target.value || undefined,
                }))
              }
              className="bg-bg-surface border border-line rounded-md px-2.5 py-1 text-xs text-ink-primary hover:border-ink-primary/20 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none focus:border-ink-primary/40 focus:ring-2 focus:ring-ink-primary/10"
            >
              <option value="">全部平台</option>
              <option value="weban">安全微伴</option>
              <option value="jiangsu">江苏安全通</option>
            </select>
            <select
              value={filter.status ?? ''}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  status: e.target.value || undefined,
                }))
              }
              className="bg-bg-surface border border-line rounded-md px-2.5 py-1 text-xs text-ink-primary hover:border-ink-primary/20 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none focus:border-ink-primary/40 focus:ring-2 focus:ring-ink-primary/10"
            >
              <option value="">全部状态</option>
              <option value="awaiting_payment">待支付</option>
              <option value="pending">待执行</option>
              <option value="running">执行中</option>
              <option value="done">完成</option>
              <option value="failed">失败</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-muted bg-bg-elevated">
                <th className="text-left px-4 py-2.5 font-medium">任务</th>
                <th className="text-left px-4 py-2.5 font-medium">学校</th>
                <th className="text-left px-4 py-2.5 font-medium">地区</th>
                <th className="text-left px-4 py-2.5 font-medium">状态</th>
                <th className="text-right px-4 py-2.5 font-medium">金额</th>
                <th className="text-right px-4 py-2.5 font-medium">创建</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-line hover:bg-ink-primary/[0.02] hover:translate-x-0.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group"
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-ink-primary">
                      {t.id.slice(0, 16)}...
                    </div>
                    <div className="text-[10px] text-ink-muted mt-0.5">
                      uid: {t.user?.deviceId?.slice(0, 10) ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-secondary">
                    {t.schoolName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-secondary">
                    {t.province ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    ¥{(t.amount / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-ink-muted whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleString('zh-CN', {
                      hour12: false,
                    })}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-ink-muted text-sm"
                  >
                    暂无任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Reveal>
    </main>
  );
}

function AdminDashboardSkeleton() {
  return (
    <main className="min-h-[100dvh] max-w-6xl mx-auto px-6 py-12 md:py-16">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-6">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-32 hidden md:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bezel-shell"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="bezel-core">
              <div className="card !p-4">
                <Skeleton className="h-3 w-16 mb-3" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bezel-shell">
            <div className="bezel-core">
              <div className="card">
                <Skeleton className="h-4 w-24 mb-5" />
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  danger,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  accent?: 'success';
  icon?: React.ReactNode;
}) {
  return (
    <div className="bezel-shell">
      <div className="bezel-core">
        <div className="card !p-4 hover:bg-bg-elevated transition-colors duration-200">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted mb-2">
            {icon}
            {label}
          </div>
          <p
            className={`text-2xl font-semibold tabular-nums tracking-tight ${
              danger
                ? 'text-accent-pale-red-fg'
                : accent === 'success'
                ? 'text-accent-pale-green-fg'
                : 'text-ink-primary'
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    awaiting_payment: 'bg-accent-pale-yellow-bg text-accent-pale-yellow-fg',
    pending: 'bg-bg-elevated text-ink-secondary',
    running: 'bg-accent-pale-blue-bg text-accent-pale-blue-fg',
    done: 'bg-accent-pale-green-bg text-accent-pale-green-fg',
    failed: 'bg-accent-pale-red-bg text-accent-pale-red-fg',
    timeout: 'bg-accent-pale-violet-bg text-accent-pale-violet-fg',
  };
  const labels: Record<string, string> = {
    awaiting_payment: '待支付',
    pending: '待执行',
    running: '执行中',
    done: '完成',
    failed: '失败',
    timeout: '超时',
  };
  return (
    <span
      className={`pill ${
        map[status] || 'bg-bg-elevated text-ink-secondary'
      }`}
    >
      {status === 'running' && (
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
      )}
      {labels[status] || status}
    </span>
  );
}
