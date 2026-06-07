import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tray } from '@phosphor-icons/react';

interface Action {
  label: string;
  to: string;
}

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: Action;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div className={className ?? ''}>
      <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card flex flex-col items-center text-center py-16 px-6">
            <div className="bezel-shell mb-6">
              <div className="bezel-core">
                <div className="w-14 h-14 rounded-2xl bg-bg-elevated flex items-center justify-center text-ink-secondary">
                  {icon ?? <Tray size={22} weight="regular" />}
                </div>
              </div>
            </div>
            <h3 className="text-base font-medium text-ink-primary mb-1.5">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-ink-secondary mb-7 max-w-sm leading-relaxed">
                {description}
              </p>
            )}
            {action && (
              <Link to={action.to} className="btn-primary group">
                {action.label}
                <span className="btn-icon-nest">
                  <ArrowRight size={12} weight="bold" />
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
