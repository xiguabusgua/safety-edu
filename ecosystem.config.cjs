/**
 * PM2 ecosystem for safety-edu
 *
 * 用法:
 *   pm2 start ecosystem.config.cjs --env production
 *
 * 两个进程:
 *   - safety-api    : Express API + 静态文件 (单进程,端口 ${PORT:-3002})
 *   - safety-runner : Node taskRunner (轮询 paid 任务, spawn Python worker)
 *
 * 前端已由 Express 直接 serve dist/,不需要独立 web 进程。
 * nginx 只需反代到 Express 端口即可,见 scripts/nginx-vhost.conf。
 */
module.exports = {
  apps: [
    // ============ Express API + 静态前端 ============
    {
      name: 'safety-api',
      cwd: './',
      script: 'apps/api/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 8000,
      node_args: ['--max-old-space-size=512'],
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      out_file: './shared/logs/api-out.log',
      error_file: './shared/logs/api-error.log',
      merge_logs: true,
      time: true,
    },

    // ============ Task Runner (轮询 + spawn Python worker) ============
    {
      name: 'safety-runner',
      cwd: './',
      script: 'apps/api/dist/workers/taskRunner.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      kill_timeout: 15000,
      node_args: ['--max-old-space-size=1024'],
      env: {
        NODE_ENV: 'development',
        RUNNER_CONCURRENCY: 2,
      },
      env_production: {
        NODE_ENV: 'production',
        RUNNER_CONCURRENCY: 3,
      },
      out_file: './shared/logs/runner-out.log',
      error_file: './shared/logs/runner-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
