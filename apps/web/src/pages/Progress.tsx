import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowSquareOut,
  QrCode,
  Warning,
  ArrowsClockwise,
  Pulse,
  Receipt,
} from '@phosphor-icons/react';
import { Skeleton } from '../components/Skeleton';
import type { TaskEvent as TEvent, TaskResult } from 'shared-types';

type Status =
  | 'connecting'
  | 'awaiting_payment'
  | 'paid'
  | 'running'
  | 'done'
  | 'failed';

type PayChannel = 'wechat_native' | 'mock';

export default function Progress() {
  const { taskId } = useParams<{ taskId: string }>();
  const [events, setEvents] = useState<TEvent[]>([]);
  const [status, setStatus] = useState<Status>('connecting');
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [payQrCode, setPayQrCode] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [progress, setProgress] = useState({ phase: '', current: 0, total: 0 });
  const [result, setResult] = useState<TaskResult | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  async function createPayOrder(channel: PayChannel = 'wechat_native') {
    if (!taskId) return;
    try {
      const r = await fetch('/api/pay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ taskId, channel }),
      });
      if (!r.ok) return;
      const pay = await r.json();
      setPayUrl(pay.payUrl);
      setPayQrCode(pay.qrCode ?? null);
      // 后端 pay/create 返 amount (分) — 没返就兜底 0,渲染时显示默认 5.00
      setPayAmount(typeof pay.amount === 'number' ? pay.amount : 0);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (!taskId) return;

    fetch(`/api/tasks/${taskId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((t) => {
        if (t.status === 'awaiting_payment') {
          return createPayOrder('wechat_native');
        }
      })
      .catch(() => null);

    const es = new EventSource(`/api/stream/${taskId}`, { withCredentials: true });

    es.onmessage = (e) => {
      try {
        const data: any = JSON.parse(e.data);
        if (!data.event) return;
        setEvents((prev) => [...prev, data]);

        switch (data.event) {
          case 'awaiting_payment':
            setStatus('awaiting_payment');
            if (data.payUrl) setPayUrl(data.payUrl);
            if (data.qrCode) setPayQrCode(data.qrCode);
            if (typeof data.amount === 'number') setPayAmount(data.amount);
            break;
          case 'paid':
            setStatus('paid');
            break;
          case 'phase':
            if (data.phase !== 'done') setStatus('running');
            break;
          case 'progress':
            setProgress({ phase: data.phase, current: data.current, total: data.total });
            break;
          case 'done':
            setStatus('done');
            setResult(data.result);
            break;
          case 'error':
            setStatus('failed');
            break;
        }
      } catch (err) {
        console.error('parse event error', err);
      }
    };

    return () => es.close();
  }, [taskId]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  if (status === 'done' && result) {
    return (
      <main className="min-h-[100dvh] max-w-2xl mx-auto px-6 py-20 md:py-28">
        <div className="w-14 h-14 rounded-2xl bg-accent-pale-green-bg text-accent-pale-green-fg flex items-center justify-center mb-6 animate-scale-in">
          <CheckCircle size={28} weight="fill" />
        </div>
        <h1 className="font-serif text-3xl tracking-tight mb-2">完成</h1>
        <p className="text-ink-secondary mb-10">
          学习 {result.study?.passed ?? 0}/
          {(result.study?.passed ?? 0) + (result.study?.failed ?? 0)} ·
          考试 {result.exam?.passed ?? 0}/
          {(result.exam?.passed ?? 0) + (result.exam?.failed ?? 0)}
        </p>
        <ResultPanel result={result} />
        <div className="flex items-center gap-3 mt-8">
          <Link to="/" className="btn-ghost group">
            返回首页
            <span className="btn-icon-nest">
              <ArrowRight size={11} weight="bold" />
            </span>
          </Link>
          <Link to="/my-tasks" className="btn-primary group">
            我的任务
            <span className="btn-icon-nest">
              <ArrowRight size={12} weight="bold" />
            </span>
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'failed') {
    const err = events.find((e): e is Extract<TEvent, { event: 'error' }> => e.event === 'error');
    return (
      <main className="min-h-[100dvh] max-w-2xl mx-auto px-6 py-20 md:py-28">
        <div className="w-14 h-14 rounded-2xl bg-accent-pale-red-bg text-accent-pale-red-fg flex items-center justify-center mb-6 animate-scale-in">
          <XCircle size={28} weight="fill" />
        </div>
        <h1 className="font-serif text-3xl tracking-tight mb-2">任务失败</h1>
        <p className="text-ink-secondary mb-8 text-sm">
          任务未完成,可能是账号信息有误或平台接口变更。
        </p>
        <ErrorPanel message={err?.msg} code={err?.code} />
        <div className="flex items-center gap-3 mt-8">
          <Link to="/" className="btn-ghost group">
            返回首页
            <span className="btn-icon-nest">
              <ArrowRight size={11} weight="bold" />
            </span>
          </Link>
          <Link to="/my-tasks" className="btn-outline group">
            <ArrowsClockwise size={13} weight="bold" />
            再试一次
            <span className="btn-icon-nest">
              <ArrowRight size={11} weight="bold" />
            </span>
          </Link>
        </div>
      </main>
    );
  }

  return (
      <main className="min-h-[100dvh] max-w-2xl mx-auto px-6 py-20 md:py-28">
      <p className="smallcaps mb-3 flex items-center gap-2">
        <span className="font-mono">{taskId}</span>
        <span className="opacity-50">·</span>
        <span>实时任务</span>
      </p>
      <h1 className="font-serif text-3xl tracking-tight mb-2">
        {status === 'awaiting_payment'
          ? '请扫码支付'
          : status === 'paid'
          ? '已支付,开始处理'
          : status === 'running'
          ? '正在执行'
          : '正在连接...'}
      </h1>
      <p className="text-sm text-ink-secondary mb-10 flex items-center gap-1.5">
        {status === 'running' || status === 'paid' ? (
          <>
            <Pulse size={12} weight="fill" className="text-accent-pale-green-fg animate-pulse" />
            实时同步中
          </>
        ) : (
          '保持页面打开,完成后会自动跳转'
        )}
      </p>

      {status === 'awaiting_payment' && (
        <div className="bezel-shell mb-8">
          <div className="bezel-core">
        <div className="card !p-7 animate-scale-in">
          <p className="smallcaps mb-4 text-center">支付方式</p>
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-pill bg-[#07C160]/10 text-[#06A050] border border-[#07C160]/20">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8.5 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM9 4l-1.4 1.4L9 6.8l1.4-1.4L9 4zm6 0l-1.4 1.4L15 6.8l1.4-1.4L15 4zM4 8h16v2H4V8zm0 4h16c0 4.4-3.6 8-8 8s-8-3.6-8-8z" />
              </svg>
              <span className="text-sm font-medium">微信支付</span>
            </div>
          </div>
          <p className="text-sm text-ink-secondary mb-5 text-center">
            请用
            <span className="text-ink-primary font-medium mx-1">微信</span>
            扫描下方二维码完成支付
          </p>
          {payQrCode ? (
            <div className="w-48 h-48 mx-auto bg-white rounded-md overflow-hidden">
              <img
                src={payQrCode}
                alt="支付二维码"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-48 h-48 mx-auto bg-bg-elevated rounded-md flex flex-col items-center justify-center text-ink-muted gap-2">
              <QrCode size={28} weight="regular" />
              <span className="text-xs">二维码加载中...</span>
            </div>
          )}
          {payUrl && (
            <a
              href={payUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-5 w-full justify-center group"
            >
              去支付 ¥{payAmount > 0 ? (payAmount / 100).toFixed(2) : '5.00'}
              <span className="btn-icon-nest">
                <ArrowSquareOut size={11} weight="bold" />
              </span>
            </a>
          )}
          <p className="text-xs text-ink-muted text-center mt-7">
            支付完成后此页面会自动跳转
          </p>
        </div>
          </div>
        </div>
      )}

      {(status === 'running' || status === 'paid') && progress.total > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-ink-secondary">
              阶段:{phaseLabel(progress.phase)}
            </span>
            <span className="font-mono text-ink-primary tabular-nums">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="h-1 bg-bg-elevated rounded-pill overflow-hidden">
            <div
              className="h-full bg-ink-primary transition-all duration-500"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="os-chrome">
          <span className="os-dot" />
          <span className="os-dot" />
          <span className="os-dot" />
          <span className="text-xs text-ink-muted ml-3 font-mono">log</span>
        </div>
        <div
          ref={logRef}
          className="p-5 h-80 overflow-y-auto font-mono text-xs leading-relaxed bg-bg-surface"
        >
          {events.filter((e) => e.event === 'log').length === 0 &&
            status === 'connecting' && (
              <div className="space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            )}
          {events
            .filter((e) => e.event === 'log')
            .map((e, i) => (
              <div key={i} className="text-ink-secondary flex gap-2">
                <span className="text-ink-muted tabular-nums select-none">
                  {String(i + 1).padStart(3, '0')}
                </span>
                <span>{e.event === 'log' ? e.msg : ''}</span>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}

function phaseLabel(p: string) {
  return { study: '学习中', exam: '考试中', login: '登录中' }[p] || p;
}

function ResultPanel({ result }: { result: TaskResult }) {
  return (
    <div className="space-y-3">
      <div className="card !p-5">
        <p className="smallcaps mb-3">学习明细</p>
        <p className="text-sm text-ink-primary">
          成功{' '}
          <span className="text-2xl font-semibold tabular-nums text-accent-pale-green-fg">
            {result.study?.passed ?? 0}
          </span>{' '}
          门,失败{' '}
          <span className="text-2xl font-semibold tabular-nums text-ink-muted">
            {result.study?.failed ?? 0}
          </span>{' '}
          门
        </p>
      </div>

      {result.exam && (
        <div className="card !p-5">
          <p className="smallcaps mb-3">考试明细</p>
          <p className="text-sm text-ink-primary">
            合格{' '}
            <span className="text-2xl font-semibold tabular-nums text-accent-pale-green-fg">
              {result.exam.passed ?? 0}
            </span>{' '}
            门,未合格{' '}
            <span className="text-2xl font-semibold tabular-nums text-ink-muted">
              {result.exam.failed ?? 0}
            </span>{' '}
            门
          </p>
        </div>
      )}

      {result.cert_url && (
        <a
          href={result.cert_url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary mt-2 inline-flex group"
        >
          <Receipt size={14} weight="bold" />
          查看证书
          <span className="btn-icon-nest">
            <ArrowSquareOut size={11} weight="bold" />
          </span>
        </a>
      )}
    </div>
  );
}

function ErrorPanel({ message, code }: { message?: string; code?: string }) {
  return (
    <div className="card !p-5 flex items-start gap-3">
      <Warning
        size={16}
        weight="bold"
        className="text-accent-pale-red-fg flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-primary mb-1">
          {message || '未知错误'}
        </p>
        {code && (
          <p className="text-xs text-ink-muted font-mono">错误码:{code}</p>
        )}
      </div>
    </div>
  );
}
