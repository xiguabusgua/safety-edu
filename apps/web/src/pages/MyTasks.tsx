import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClockCounterClockwise, ArrowUpRight } from '@phosphor-icons/react';
import EmptyState from '../components/EmptyState';
import Reveal from '../components/Reveal';
import { Skeleton } from '../components/Skeleton';

interface MyTask {
  id: string;
  platform: 'weban' | 'jiangsu';
  status: string;
  amount: number;
  schoolName: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const statusLabel: Record<string, string> = {
  awaiting_payment: '待支付',
  pending: '排队中',
  running: '执行中',
  done: '完成',
  failed: '失败',
  timeout: '超时',
};

const statusPill: Record<string, string> = {
  awaiting_payment: 'bg-accent-pale-yellow-bg text-accent-pale-yellow-fg',
  pending: 'bg-bg-elevated text-ink-secondary',
  running: 'bg-accent-pale-blue-bg text-accent-pale-blue-fg',
  done: 'bg-accent-pale-green-bg text-accent-pale-green-fg',
  failed: 'bg-accent-pale-red-bg text-accent-pale-red-fg',
  timeout: 'bg-accent-pale-violet-bg text-accent-pale-violet-fg',
};

export default function MyTasks() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-tasks', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-[100dvh] max-w-2xl mx-auto px-6 py-20 md:py-28">
      <p className="smallcaps mb-3 flex items-center gap-1.5">
        <ClockCounterClockwise size={11} weight="bold" />
        我的任务
      </p>
      <h1 className="font-serif text-3xl tracking-tight mb-2">最近 20 次</h1>
      <p className="text-sm text-ink-secondary mb-10 leading-relaxed">
        通过浏览器 cookie 识别,不需登录。换浏览器或清缓存会重置。
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card !p-4 flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise size={22} weight="regular" />}
          title="还没有任务"
          description="提交账号并支付后,任务会出现在这里。完成的任务可以随时回看进度。"
          action={{ label: '立即开始', to: '/' }}
        />
      ) : (
        <div className="space-y-2.5">
          {tasks.map((t, i) => (
            <Reveal key={t.id} delay={i * 40}>
              <div className="bezel-shell">
                <div className="bezel-core">
                  <Link
                    to={`/task/${t.id}`}
                    className="card card-hover !p-4 flex items-center justify-between group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-primary truncate">
                        {t.schoolName ||
                          (t.platform === 'weban' ? '安全微伴' : '江苏安全通')}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5 font-mono truncate">
                        {t.id}
                      </p>
                      <p className="text-[10px] text-ink-muted mt-1">
                        {new Date(t.createdAt).toLocaleString('zh-CN', {
                          hour12: false,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span
                          className={`pill mb-1.5 inline-block ${
                            statusPill[t.status] ||
                            'bg-bg-elevated text-ink-secondary'
                          }`}
                        >
                          {statusLabel[t.status] || t.status}
                        </span>
                        <p className="text-sm font-mono tabular-nums">
                          ¥{(t.amount / 100).toFixed(2)}
                        </p>
                      </div>
                      <ArrowUpRight
                        size={14}
                        weight="bold"
                        className="text-ink-muted group-hover:text-ink-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                      />
                    </div>
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
