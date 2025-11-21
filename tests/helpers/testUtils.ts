import { ModelConfig } from '../../types/models';
import type { AgentType } from '../../tests/fixtures/agents';
import type { BlackboardItem } from '../../tests/fixtures/blackboard';

export function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = async () => {
      if (await condition()) {
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`waitFor condition not met within ${timeout}ms`));
        return;
      }
      
      setTimeout(check, interval);
    };
    
    check();
  });
}

export function mockDate(date: Date | string | number): () => void {
  const dateValue = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  
  const originalDateNow = Date.now;
  const originalDate = global.Date;
  
  global.Date = class extends originalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(dateValue);
      } else {
        super(...(args as [number, number, number]));
      }
    }
    
    static now() {
      return dateValue.getTime();
    }
  } as any;
  
  return () => {
    global.Date = originalDate;
    Date.now = originalDateNow;
  };
}

// Factory functions for test data are in fixtures/

// Custom assertion helpers
export function assertIsUUID(value: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error(`Expected UUID but got: ${value}`);
  }
}

export function assertIsTimestamp(value: any): void {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Expected timestamp but got: ${typeof value}`);
  }
}

export function assertBlackboardItemStructure(item: BlackboardItem): void {
  if (!item.id || !item.type || !item.summary || !item.dimensions || !item.links) {
    throw new Error('Blackboard item missing required fields');
  }
  
  assertIsUUID(item.id);
  
  if (!Array.isArray(item.links.parents) && item.links.parents !== undefined) {
    throw new Error('links.parents must be an array or undefined');
  }
  
  if (!Array.isArray(item.links.children) && item.links.children !== undefined) {
    throw new Error('links.children must be an array or undefined');
  }
}

