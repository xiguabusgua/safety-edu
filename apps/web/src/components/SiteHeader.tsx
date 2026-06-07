import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, ListChecks, ShieldCheck } from '@phosphor-icons/react';
import ThemeToggle from './ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  {
    to: '/',
    label: '首页',
    icon: <House size={14} weight="bold" />,
    match: (p) => p === '/',
  },
  {
    to: '/my-tasks',
    label: '任务',
    icon: <ListChecks size={14} weight="bold" />,
    match: (p) => p.startsWith('/my-tasks') || p.startsWith('/task/'),
  },
  {
    to: '/legal',
    label: '条款',
    icon: <ShieldCheck size={14} weight="bold" />,
    match: (p) => p.startsWith('/legal'),
  },
];

export default function SiteHeader() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/task/')) {
    return null;
  }

  return (
    <header className="sticky top-4 z-40 mt-4 mb-2 mx-auto w-max max-w-[calc(100vw-2rem)] pointer-events-none">
      <div className="bezel-shell pointer-events-auto">
        <div className="bezel-core">
          <nav className="flex items-center gap-1 rounded-pill bg-bg-base/85 backdrop-blur-xl px-1.5 py-1.5">
            <Link
              to="/"
              className="flex items-center gap-2 px-2 py-1 rounded-pill group"
              aria-label="返回首页"
            >
              <span className="w-6 h-6 rounded-md bg-gradient-to-br from-ink-primary to-ink-secondary flex items-center justify-center text-[11px] font-semibold text-bg-surface group-hover:rotate-[-4deg] transition-transform duration-200">
                S
              </span>
              <span className="hidden sm:inline text-sm font-medium tracking-tight text-ink-primary pr-1">
                safety edu
              </span>
            </Link>
            <span className="hidden sm:inline-block w-px h-5 bg-line" />
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-pill text-sm transition-colors duration-200 active:scale-95 ${
                    active
                      ? 'text-ink-primary bg-ink-primary/[0.06]'
                      : 'text-ink-muted hover:text-ink-primary hover:bg-ink-primary/[0.04]'
                  }`}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <span className="hidden sm:inline-block w-px h-5 bg-line" />
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
