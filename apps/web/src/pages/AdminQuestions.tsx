import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash, Books, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import Reveal from '../components/Reveal';

interface Question {
  id: number;
  platform: string;
  category: string | null;
  questionText: string;
  options: string | null;
  answer: string;
  questionType: string;
  hitCount: number;
  createdAt: string;
}

interface QuestionStat {
  platform: string;
  _count: { _all: number };
}

export default function AdminQuestions() {
  const navigate = useNavigate();
  const token = localStorage.getItem('admin_token');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [q, setQ] = useState('');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/admin/login', { replace: true });
    }
  }, [token, navigate]);

  async function load(signal?: AbortSignal) {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (q) params.set('q', q);
    try {
      const [listRes, stRes] = await Promise.all([
        fetch(`/api/admin/questions?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        }),
        fetch('/api/admin/questions/stats', {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        }),
      ]);
      if (listRes.status === 401 || stRes.status === 401) {
        localStorage.removeItem('admin_token');
        toast.error('登录已过期');
        navigate('/admin/login', { replace: true });
        return;
      }
      const [list, st] = await Promise.all([listRes.json(), stRes.json()]);
      setQuestions(list.questions || []);
      setTotal(list.total || 0);
      setStats(st.byPlatform || []);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  async function onDelete(id: number) {
    if (!token) return;
    if (!confirm(`删除题目 #${id}?`)) return;
    try {
      const r = await fetch(`/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        localStorage.removeItem('admin_token');
        navigate('/admin/login', { replace: true });
        return;
      }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error?.message || '删除失败');
        return;
      }
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const webanCount = stats.find((s) => s.platform === 'weban')?._count._all ?? 0;
  const jiangsuCount = stats.find((s) => s.platform === 'jiangsu')?._count._all ?? 0;

  return (
    <div className="space-y-4 px-6 py-8 md:py-12 max-w-6xl mx-auto min-h-[100dvh]">
      {/* 顶部统计 */}
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bezel-shell">
          <div className="bezel-core">
            <div className="card !p-4">
              <p className="text-xs text-ink-muted mb-1">题库总数</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {total}
              </p>
            </div>
          </div>
        </div>
        <div className="bezel-shell">
          <div className="bezel-core">
            <div className="card !p-4">
              <p className="text-xs text-ink-muted mb-1">安全微伴</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-accent-pale-blue-fg">
                {webanCount}
              </p>
            </div>
          </div>
        </div>
        <div className="bezel-shell">
          <div className="bezel-core">
            <div className="card !p-4">
              <p className="text-xs text-ink-muted mb-1">江苏安全通</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-accent-pale-yellow-fg">
                {jiangsuCount}
              </p>
            </div>
          </div>
        </div>
      </div>
      </Reveal>

      {/* 过滤 + 导入 */}
      <Reveal delay={80}>
        <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card !p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <button
                onClick={() => setPlatform('')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  platform === ''
                    ? 'bg-ink-primary text-bg-surface'
                    : 'text-ink-muted hover:text-ink-primary hover:bg-ink-primary/[0.04]'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setPlatform('weban')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  platform === 'weban'
                    ? 'bg-accent-pale-blue-bg text-accent-pale-blue-fg'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                安全微伴
              </button>
              <button
                onClick={() => setPlatform('jiangsu')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  platform === 'jiangsu'
                    ? 'bg-accent-pale-yellow-bg text-accent-pale-yellow-fg'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                江苏安全通
              </button>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="搜索题干…"
                className="input !py-1.5 !text-xs max-w-[200px]"
              />
              <button
                onClick={() => load()}
                className="px-3 py-1.5 rounded-md text-ink-muted hover:text-ink-primary hover:bg-ink-primary/[0.04]"
              >
                搜索
              </button>
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="btn-primary text-sm group"
            >
              <Plus size={14} weight="bold" />
              批量导入
            </button>
          </div>
        </div>
        </div>
      </Reveal>

      {/* 题目列表 */}
      <Reveal delay={160}>
        <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card !p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-ink-muted">加载中…</div>
            ) : questions.length === 0 ? (
              <div className="p-12 text-center">
                <Books
                  size={32}
                  weight="regular"
                  className="text-ink-muted mx-auto mb-3"
                />
                <p className="text-sm text-ink-muted mb-4">还没有题目</p>
                <button
                  onClick={() => setShowImport(true)}
                  className="btn-primary text-sm group"
                >
                  <Plus size={14} weight="bold" />
                  导入第一批题目
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-ink-muted bg-bg-elevated">
                      <th className="text-left px-4 py-2.5 font-medium w-20">#</th>
                      <th className="text-left px-4 py-2.5 font-medium w-20">平台</th>
                      <th className="text-left px-4 py-2.5 font-medium">题干</th>
                      <th className="text-left px-4 py-2.5 font-medium w-28">答案</th>
                      <th className="text-right px-4 py-2.5 font-medium w-20">命中</th>
                      <th className="text-right px-4 py-2.5 font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr
                        key={q.id}
                        className="border-t border-line hover:bg-ink-primary/[0.02] transition-colors group"
                      >
                        <td className="px-4 py-3 text-xs text-ink-muted font-mono">
                          #{q.id}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`pill ${
                              q.platform === 'weban'
                                ? 'bg-accent-pale-blue-bg text-accent-pale-blue-fg'
                                : 'bg-accent-pale-yellow-bg text-accent-pale-yellow-fg'
                            }`}
                          >
                            {q.platform === 'weban' ? '微伴' : '江苏'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-primary max-w-[500px]">
                          <p className="line-clamp-2">{q.questionText}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-secondary font-mono">
                          {q.answer}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-ink-muted font-mono tabular-nums">
                          {q.hitCount}
                        </td>
                        <td className="px-4 py-3 text-right">
              <button
                onClick={() => onDelete(q.id)}
                className="p-1.5 rounded-md text-ink-muted hover:text-accent-pale-red-fg hover:bg-accent-pale-red-bg opacity-0 group-hover:opacity-100 transition-all"
                title="删除"
              >
                <Trash size={13} weight="bold" />
              </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showImport && token && (
        <ImportModal
          token={token}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
      </Reveal>
    </div>
  );
}

function ImportModal({
  token,
  onClose,
  onSuccess,
}: {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [platform, setPlatform] = useState<'weban' | 'jiangsu'>('weban');
  const [jsonText, setJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    submitted: number;
    inserted: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parseJson(): any[] | null {
    setError(null);
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setError('JSON 必须是数组');
        return null;
      }
      return parsed;
    } catch (e) {
      setError('JSON 解析失败: ' + (e as Error).message);
      return null;
    }
  }

  async function onSubmit(dryRun: boolean) {
    const items = parseJson();
    if (!items) return;

    setSubmitting(true);
    setError(null);
    try {
      // 字段映射:支持多种格式(answer.json 可能有不同字段名)
      const mapped = items.map((it: any) => ({
        questionText: it.questionText ?? it.question ?? it.q ?? '',
        options: it.options ?? it.choices ?? it.answers ?? null,
        answer: it.answer ?? it.a ?? '',
        questionType: it.questionType ?? it.type ?? 'single',
        category: it.category ?? it.cat ?? null,
      }));

      const r = await fetch('/api/admin/questions/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          items: mapped,
          dryRun,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error?.message || d.message || `HTTP ${r.status}`);
      }
      const data = await r.json();
      if (dryRun) {
        setResult({ submitted: data.count, inserted: 0 });
      } else {
        setResult({ submitted: data.submitted, inserted: data.inserted });
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-sm animate-fade-in">
      <div className="bezel-shell w-full max-w-2xl">
        <div className="bezel-core">
          <div className="card !p-0 overflow-hidden bg-bg-surface">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-base font-medium">批量导入题库</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-ink-muted hover:text-ink-primary hover:bg-ink-primary/[0.06] transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="label">目标平台</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlatform('weban')}
                    className={`flex-1 py-2.5 rounded-lg text-sm transition-all ${
                      platform === 'weban'
                        ? 'bg-accent-pale-blue-bg text-accent-pale-blue-fg ring-2 ring-accent-pale-blue-fg/30'
                        : 'bg-bg-elevated text-ink-secondary'
                    }`}
                  >
                    安全微伴
                  </button>
                  <button
                    onClick={() => setPlatform('jiangsu')}
                    className={`flex-1 py-2.5 rounded-lg text-sm transition-all ${
                      platform === 'jiangsu'
                        ? 'bg-accent-pale-yellow-bg text-accent-pale-yellow-fg ring-2 ring-accent-pale-yellow-fg/30'
                        : 'bg-bg-elevated text-ink-secondary'
                    }`}
                  >
                    江苏安全通
                  </button>
                </div>
              </div>

              <div>
                <label className="label">
                  粘贴 JSON 数组
                  <span className="text-ink-muted font-normal ml-2">
                    字段:questionText / options / answer / questionType / category
                  </span>
                </label>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={10}
                  className="input font-mono text-xs"
                  placeholder={`[
  { "questionText": "校园内防火安全...", "options": ["A. 立即逃生","B. 报警","C. 灭火","D. 继续上课"], "answer": "A", "questionType": "single", "category": "消防" }
]`}
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-accent-pale-red-bg text-accent-pale-red-fg text-xs">
                  {error}
                </div>
              )}

              {result && (
                <div className="px-3 py-2 rounded-lg bg-accent-pale-green-bg text-accent-pale-green-fg text-xs">
                  提交 {result.submitted} 道题 → 写入 {result.inserted} 道
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2 bg-bg-elevated">
              <button
                onClick={onClose}
                className="btn-ghost text-sm"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={() => onSubmit(true)}
                className="btn-outline text-sm"
                disabled={submitting || !jsonText}
              >
                校验(dryRun)
              </button>
              <button
                onClick={() => onSubmit(false)}
                className="btn-primary text-sm group"
                disabled={submitting || !jsonText}
              >
                {submitting ? '导入中…' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
