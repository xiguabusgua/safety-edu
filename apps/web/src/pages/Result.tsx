import { Link, useParams } from 'react-router-dom';
import { CheckCircle, ArrowRight } from '@phosphor-icons/react';

export default function Result() {
  const { taskId } = useParams();
  return (
    <main className="min-h-[100dvh] max-w-2xl mx-auto px-6 py-20 md:py-28">
      <div className="w-14 h-14 rounded-2xl bg-accent-pale-green-bg text-accent-pale-green-fg flex items-center justify-center mb-6 animate-scale-in">
        <CheckCircle size={28} weight="fill" />
      </div>
      <h1 className="font-serif text-3xl tracking-tight mb-2">完成</h1>
      <p className="text-ink-secondary mb-2 text-sm">任务已执行完成。</p>
      <p className="text-xs text-ink-muted font-mono mb-10">{taskId}</p>
      <Link to="/my-tasks" className="btn-primary group">
        查看我的任务
        <span className="btn-icon-nest">
          <ArrowRight size={12} weight="bold" />
        </span>
      </Link>
    </main>
  );
}
