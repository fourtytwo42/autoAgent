/**
 * Helper for testing Server-Sent Events (SSE) streams
 */
export class SSEStreamReader {
  private eventSource: EventSource | null = null;
  private messages: string[] = [];
  private errors: Error[] = [];

  constructor(url: string) {
    // Note: EventSource is browser-only, for Node.js tests we'll need a different approach
    // This is a placeholder structure - actual implementation will depend on Next.js SSE setup
    this.eventSource = null;
  }

  /**
   * Read all events from SSE stream
   */
  async readAll(timeout = 5000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.eventSource) {
        reject(new Error('EventSource not initialized'));
        return;
      }

      const timer = setTimeout(() => {
        this.close();
        reject(new Error(`SSE stream timeout after ${timeout}ms`));
      }, timeout);

      this.eventSource.onmessage = (event) => {
        this.messages.push(event.data);
      };

      this.eventSource.onerror = (error) => {
        const errorObj = new Error('SSE connection error');
        this.errors.push(errorObj);
        clearTimeout(timer);
        this.close();
        reject(errorObj);
      };

      // For tests, we'll need to simulate or mock EventSource
      // This is a placeholder
      setTimeout(() => {
        clearTimeout(timer);
        resolve(this.messages);
      }, 1000);
    });
  }

  /**
   * Read events until a condition is met
   */
  async readUntil(
    condition: (messages: string[]) => boolean,
    timeout = 5000
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.close();
        reject(new Error(`SSE stream timeout after ${timeout}ms`));
      }, timeout);

      const checkInterval = setInterval(() => {
        if (condition(this.messages)) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve(this.messages);
        }
      }, 100);

      this.eventSource?.addEventListener('message', (event) => {
        this.messages.push(event.data);
        if (condition(this.messages)) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          this.close();
          resolve(this.messages);
        }
      });
    });
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  getErrors(): Error[] {
    return [...this.errors];
  }
}

/**
 * Mock SSE stream for testing
 * This can be used to simulate SSE streams in tests
 */
export class MockSSEStream {
  private messages: Array<{ event?: string; data: string }> = [];
  private listeners: Map<string, ((event: any) => void)[]> = new Map();

  emit(event: string, data: string): void {
    this.messages.push({ event, data });
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler({ data }));
  }

  on(event: string, handler: (event: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  getMessages(): Array<{ event?: string; data: string }> {
    return [...this.messages];
  }
}

