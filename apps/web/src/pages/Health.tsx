import { useEffect, useState } from 'react';
import { Pulse, Database, Clock, Hash, ArrowsClockwise } from '@phosphor-icons/react';

interface HealthResp {
  status: 'ok' | 'degraded';
  ts: number;
  uptimeSec: number;
  version: string;
  checks: {
    db: { ok: boolean; latencyMs: number };
  };
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function Health() {
  const [data, setData] = useState<HealthResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/health`);
      const d = (await r.json()) as HealthResp;
      setData(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const isOk = data?.status === 'ok';

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-12 md:py-20">
      <div className="flex items-center gap-2 mb-2">
        <Pulse size={14} weight="bold" className="text-ink-secondary" />
        <p className="smallcaps">系统状态</p>
      </div>
      <h1 className="font-serif text-3xl tracking-tight mb-2">
        safety edu api
      </h1>
      <p className="text-sm text-ink-secondary mb-10 flex items-center gap-2">
        <Hash size={12} weight="regular" className="text-ink-muted" />
        <span className="font-mono">{API_BASE}/api/health</span>
      </p>

      <div className="space-y-3">
        {/* 状态卡 */}
        <div className="bezel-shell">
          <div className="bezel-core">
            <div className="card flex items-center justify-between !p-5">
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isOk
                      ? 'bg-accent-pale-green-fg'
                      : data
                      ? 'bg-accent-pale-red-fg'
                      : 'bg-ink-muted'
                  } ${loading ? 'animate-pulse' : ''}`}
                />
                <div>
                  <p className="text-base font-medium text-ink-primary">
                    {isOk ? '服务正常' : data ? '服务降级' : '检测中'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {data
                      ? `version ${data.version} · ${formatTs(data.ts)}`
                      : '查询后端状态...'}
                  </p>
                </div>
              </div>
              <button
                onClick={load}
                className="btn-ghost text-sm"
                aria-label="手动刷新"
              >
                <ArrowsClockwise
                  size={14}
                  weight="bold"
                  className={loading ? 'animate-spin' : ''}
                />
                刷新
              </button>
            </div>
          </div>
        </div>

        {/* 详情列表 */}
        <div className="bezel-shell">
          <div className="bezel-core">
            <div className="card !p-5 space-y-4">
              <DetailRow
                icon={<Database size={14} weight="bold" />}
                label="数据库"
                value={data ? (data.checks.db.ok ? '连通' : '失败') : '—'}
                accent={data ? (data.checks.db.ok ? 'success' : 'danger') : 'muted'}
              />
              <DetailRow
                icon={<Clock size={14} weight="bold" />}
                label="DB 延迟"
                value={data ? `${data.checks.db.latencyMs} ms` : '—'}
                accent="muted"
                mono
              />
              <DetailRow
                icon={<Pulse size={14} weight="bold" />}
                label="运行时长"
                value={data ? formatUptime(data.uptimeSec) : '—'}
                accent="muted"
                mono
              />
              <DetailRow
                icon={<Hash size={14} weight="bold" />}
                label="version"
                value={data?.version ?? '—'}
                accent="muted"
                mono
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="card !p-4 flex items-start gap-2 bg-accent-pale-red-bg text-accent-pale-red-fg text-sm animate-scale-in">
            <span className="font-medium">连接失败</span>
            <span className="text-accent-pale-red-fg/80">— {error}</span>
          </div>
        )}

        <p className="text-[10px] text-ink-muted tracking-wider pt-2">
          每 5 秒自动刷新
        </p>
      </div>
    </main>
  );
}

function DetailRow({
  icon,
  label,
  value,
  accent,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'success' | 'danger' | 'muted';
  mono?: boolean;
}) {
  const tone =
    accent === 'success'
      ? 'text-accent-pale-green-fg'
      : accent === 'danger'
      ? 'text-accent-pale-red-fg'
      : 'text-ink-primary';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-2 text-ink-secondary">
        {icon}
        {label}
      </span>
      <span className={`${tone} ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  );
}
