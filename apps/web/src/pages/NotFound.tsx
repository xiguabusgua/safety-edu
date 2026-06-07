import { Link } from 'react-router-dom';
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="smallcaps mb-4">Error 404</p>
        <div className="relative mb-6 inline-block">
          <h1 className="font-serif text-8xl tracking-tighter tabular-nums leading-none">
            404
          </h1>
          <MagnifyingGlass
            size={20}
            weight="bold"
            className="absolute -top-1 -right-6 text-ink-muted"
          />
        </div>
        <h2 className="font-serif text-2xl tracking-tight mb-2">
          页面找不到了
        </h2>
        <p className="text-sm text-ink-secondary mb-8 leading-relaxed">
          链接可能已失效,或者你访问的页面已经被移除。
        </p>
        <Link to="/" className="btn-primary group">
          回到首页
          <span className="btn-icon-nest">
            <ArrowRight size={12} weight="bold" />
          </span>
        </Link>
      </div>
    </main>
  );
}
