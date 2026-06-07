/**
 * 简单的 EventEmitter 跨进程事件总线
 * 当前实现：单进程内存版
 * 后期切 Redis pub/sub 只需替换 emit/on 内部
 */
import { EventEmitter } from 'events';

class Bus extends EventEmitter {
  emitTo(channel: string, payload: any) {
    this.emit(channel, payload);
  }
}

export const eventBus = new Bus();
eventBus.setMaxListeners(1000);
