// 前后端共享类型
// API route 返回 + SSE 事件 + 数据库模型

export type Platform = 'weban' | 'jiangsu';

export type TaskStatus =
  | 'awaiting_payment'
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'timeout';

export type TaskResult = {
  study: { passed: number; failed: number; details: any[] };
  exam: { passed: number; failed: number; details: any[] };
  cert_url: string | null;
  elapsed_sec: number;
};

export type TaskEvent =
  | { event: 'log'; level?: 'info' | 'warn' | 'error'; msg: string }
  | { event: 'phase'; phase: 'login' | 'study' | 'exam' | 'done' }
  | { event: 'progress'; phase: string; current: number; total: number }
  | { event: 'awaiting_payment'; payUrl: string; qrCode?: string }
  | { event: 'paid' }
  | {
      event: 'done';
      result: TaskResult;
    }
  | { event: 'error'; code: string; msg: string };

export interface CreateTaskInput {
  platform: Platform;
  creds: {
    // WeBan
    school?: string;
    userId: string;
    password?: string;
    // Jiangsu 用纯 userid
  };
  options?: {
    study?: boolean;
    exam?: boolean;
    maxExamRounds?: number;
  };
  /** 完成通知通道(可选) */
  notify?: {
    channel: 'email' | 'wechat';
    target: string;
  };
}

export interface CreateTaskResponse {
  taskId: string;
  amount: number; // 分
  amountYuan: string;
  status: TaskStatus;
}

export interface CreatePayResponse {
  taskId: string;
  channel: 'alipay' | 'mock';
  payUrl: string;
  qrCode?: string;
  amount: number;
  amountYuan: string;
}

export interface AdminStats {
  total: number;
  todayCount: number;
  revenue: string; // 元
  failed: number;
  uniqueUsers: number; // ← 去重 deviceId
  byPlatform: Array<{ platform: string; count: number; revenue: string }>;
  byStatus: Array<{ status: string; count: number }>;
  byProvince: Array<{ province: string; count: number }>;
  bySchool: Array<{ school: string; count: number }>;
}

export interface AdminTask {
  id: string;
  userId: string | null;
  platform: Platform;
  status: TaskStatus;
  schoolName: string | null;
  province: string | null;
  amount: number;
  createdAt: string;
  paidAt: string | null;
  finishedAt: string | null;
  errorMsg: string | null;
  user: {
    id: string;
    deviceId: string;
    firstSeen: string;
    lastSeen: string;
  } | null;
}
