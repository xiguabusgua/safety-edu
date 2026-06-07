import { useEffect, useRef, useState } from 'react';
import { CircleNotch, WechatLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';
import QrCodeCanvas from './QrCodeCanvas';

interface Props {
  boundOpenId: string | null;
  onBound: (openId: string) => void;
}

export default function WechatQrPanel({ boundOpenId, onBound }: Props) {
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'scanned' | 'confirmed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCountRef = useRef(0);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function startScan() {
    if (qrUrl) return;
    setError(null);
    errorCountRef.current = 0;
    try {
      const r = await fetch('/api/auth/wechat-qr', { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || '获取二维码失败');
      setSceneId(data.sceneId);
      setQrUrl(data.qrUrl);
      setStatus('waiting');
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`/api/auth/wechat-qr/${data.sceneId}`);
          if (!pr.ok) { stopPolling(); setError('状态查询失败,请刷新页面重试'); setStatus('idle'); return; }
          const pdata = await pr.json().catch(() => ({}));
          errorCountRef.current = 0;
          if (pdata.status === 'scanned') setStatus('scanned');
          if (pdata.status === 'confirmed') {
            stopPolling();
            setStatus('confirmed');
            onBound(pdata.openid || 'mock-openid');
            toast.success('微信扫码成功', { description: '已绑定' });
          } else if (pdata.status === 'expired') {
            stopPolling();
            setError('二维码已过期,请重新获取');
            setStatus('idle');
            setQrUrl(null);
            setSceneId(null);
          }
        } catch {
          errorCountRef.current += 1;
          if (errorCountRef.current >= 3) { stopPolling(); setError('网络异常,自动检测已停止'); setStatus('idle'); }
        }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取二维码失败');
    }
  }

  async function devMockConfirm() {
    if (!sceneId) return;
    try {
      const r = await fetch('/api/auth/wechat-mock-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sceneId }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || 'mock 失败');
    } catch (e) { setError(e instanceof Error ? e.message : 'mock 失败'); }
  }

  if (boundOpenId) {
    return (
      <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card !p-4 flex items-start gap-3 bg-accent-pale-green-bg border border-ink-primary/[0.05]">
            <div className="w-9 h-9 rounded-full bg-accent-pale-green-bg flex items-center justify-center flex-shrink-0">
              <WechatLogo size={16} weight="duotone" className="text-accent-pale-green-fg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-primary">微信已绑定</p>
              <p className="text-xs text-ink-secondary mt-0.5 font-mono truncate">openid:{boundOpenId.slice(0, 12)}…</p>
              <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">任务完成后,结果会通过微信服务通知送达;同时作为订单凭证。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted smallcaps">微信扫码登录</p>
      <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card !p-5 flex flex-col items-center gap-3">
            {qrUrl ? (
              <>
                <div className="w-48 h-48 bg-white rounded-md overflow-hidden p-2 border border-line">
                  <QrCodeCanvas text={qrUrl} size={180} alt="微信登录二维码" className="w-full h-full" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs text-ink-secondary">
                    {status === 'waiting' && '请用微信扫描二维码'}
                    {status === 'scanned' && '已扫描,等待确认'}
                    {status === 'idle' && '点击下方按钮开始'}
                  </p>
                  {(status === 'waiting' || status === 'scanned') && (
                    <div className="flex items-center justify-center gap-1.5">
                      <CircleNotch size={10} weight="bold" className="animate-spin text-ink-muted" />
                      <span className="text-[10px] text-ink-muted">自动检测中…</span>
                    </div>
                  )}
                </div>
                {import.meta.env.DEV && status !== 'idle' && (
                  <button type="button" onClick={devMockConfirm} className="text-[10px] text-ink-muted hover:text-ink-secondary underline underline-offset-2">dev 模式:点此模拟确认</button>
                )}
              </>
            ) : (
              <button type="button" onClick={startScan} className="btn-primary px-5 py-2.5">
                <WechatLogo size={14} weight="fill" /><span>获取登录二维码</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-ink-muted leading-relaxed">微信扫码作为订单凭证 + 完成通知通道。平台账号(微伴/江苏)请仍用上方"账号密码"方式填写。</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
