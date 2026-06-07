import { spawn } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * 与 Python worker 通信的桥：
 * - fork 子进程跑 runner.py
 * - 解析 stdout 的 JSON Lines 协议
 * - 把每条事件 emit 到 bus 上
 */
export type PyEvent =
  | { event: 'log'; level: 'info' | 'warn' | 'error'; msg: string }
  | { event: 'progress'; phase: string; current: number; total: number }
  | { event: 'phase'; phase: 'login' | 'study' | 'exam' | 'done' }
  | { event: 'done'; result: any }
  | { event: 'error'; code: string; msg: string };

export class PythonJob extends EventEmitter {
  private child: ReturnType<typeof spawn> | null = null;

  constructor(
    public taskId: string,
    public payload: Record<string, unknown>,
  ) {
    super();
  }

  start() {
    const runnerPath = path.resolve(__dirname, '../../../worker/runner.py');
    const cwd = path.resolve(__dirname, '../../../worker');

    this.child = spawn('python3', [runnerPath, '--task-id', this.taskId], {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.stdin?.write(JSON.stringify(this.payload));
    this.child.stdin?.end();

    let buffer = '';
    this.child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt: PyEvent = JSON.parse(line);
          this.emit('event', evt);
        } catch {
          // 非 JSON 行视为普通日志
          this.emit('event', {
            event: 'log',
            level: 'info',
            msg: line,
          } satisfies PyEvent);
        }
      }
    });

    this.child.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) this.emit('event', { event: 'log', level: 'error', msg });
    });

    this.child.on('exit', (code) => {
      if (code !== 0) {
        this.emit('event', {
          event: 'error',
          code: 'exit_nonzero',
          msg: `python 退出码 ${code}`,
        });
      }
      this.emit('exit', code);
    });

    this.child.on('error', (err) => {
      this.emit('event', { event: 'error', code: 'spawn_error', msg: err.message });
      this.emit('exit', -1);
    });
  }

  kill() {
    this.child?.kill('SIGTERM');
  }
}
