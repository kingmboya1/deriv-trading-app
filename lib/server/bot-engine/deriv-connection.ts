/**
 * DerivConnection - Server-side WebSocket connection manager for Deriv API
 * 
 * This class manages persistent WebSocket connections to Deriv's trading API.
 * It handles connection lifecycle, authorization, message routing, and request/response patterns.
 * 
 * **Validates: Requirements 2.1, 2.2**
 */

import WebSocket from 'ws';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timestamp: number;
}

interface SubscriptionHandler {
  callback: (data: unknown) => void;
  subscriptionId: number | null;
}

export class DerivConnection {
  private ws: WebSocket | null = null;
  private apiToken: string;
  private url: string = 'wss://ws.derivws.com/websockets/v3';
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private subscriptions: Map<number, SubscriptionHandler> = new Map();
  private nextReqId: number = 1;
  private nextSubId: number = 1;
  private isAuthorized: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Connect to Deriv WebSocket API and authorize
   * **Validates: Requirements 2.1, 2.2**
   */
  async connect(): Promise<void> {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', async () => {
          console.log('[DerivConnection] WebSocket connection established');
          
          try {
            // Authorize immediately after connection
            await this.authorize();
            this.reconnectAttempts = 0;
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          console.error('[DerivConnection] WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          console.log('[DerivConnection] WebSocket closed', { code, reason: reason.toString() });
          this.isAuthorized = false;
          this.ws = null;
          
          // Handle reconnection with exponential backoff
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            console.error('[DerivConnection] Max reconnection attempts reached');
            // Reject all pending requests
            const error = new Error('Connection closed after max reconnect attempts');
            this.pendingRequests.forEach(req => req.reject(error));
            this.pendingRequests.clear();
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Authorize the connection using the API token
   * **Validates: Requirement 2.2**
   */
  private async authorize(): Promise<void> {
    if (this.isAuthorized) {
      return;
    }

    try {
      const response = await this.request<{ authorize?: { loginid: string; currency: string } }>({
        authorize: this.apiToken
      });

      if (response.authorize) {
        this.isAuthorized = true;
        console.log('[DerivConnection] Authorization successful', {
          loginid: response.authorize.loginid,
          currency: response.authorize.currency
        });
      } else {
        throw new Error('Authorization failed: no authorize data in response');
      }
    } catch (error) {
      console.error('[DerivConnection] Authorization failed:', error);
      throw error;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * **Validates: Requirement 2.3, 2.4**
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Max 30 seconds

    console.log(`[DerivConnection] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        console.log('[DerivConnection] Reconnection successful');
      } catch (error) {
        console.error('[DerivConnection] Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Send a request and wait for response
   * **Validates: Requirements 2.1, 2.2**
   */
  async request<T>(payload: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    if (!this.isAuthorized && !payload.authorize) {
      throw new Error('Connection not authorized');
    }

    const reqId = this.nextReqId++;
    const payloadWithId = { ...payload, req_id: reqId };

    return new Promise<T>((resolve, reject) => {
      // Set timeout for request (30 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`Request ${reqId} timed out after 30 seconds`));
      }, 30000);

      this.pendingRequests.set(reqId, {
        resolve: (value: unknown) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });

      try {
        this.ws!.send(JSON.stringify(payloadWithId));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(reqId);
        reject(error instanceof Error ? error : new Error('Failed to send request'));
      }
    });
  }

  /**
   * Subscribe to a stream and register a callback handler
   */
  subscribe(payload: Record<string, unknown>, callback: (data: unknown) => void): number {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const subId = this.nextSubId++;
    
    this.subscriptions.set(subId, {
      callback,
      subscriptionId: null
    });

    // Send subscription request
    this.request<{ subscription?: { id: number } }>(payload)
      .then(response => {
        if (response.subscription?.id) {
          const handler = this.subscriptions.get(subId);
          if (handler) {
            handler.subscriptionId = response.subscription.id;
          }
        }
      })
      .catch(error => {
        console.error('[DerivConnection] Subscription failed:', error);
        this.subscriptions.delete(subId);
      });

    return subId;
  }

  /**
   * Unsubscribe from a stream
   */
  unsubscribe(subId: number): void {
    const handler = this.subscriptions.get(subId);
    if (!handler) {
      return;
    }

    if (handler.subscriptionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ forget: handler.subscriptionId }));
      } catch (error) {
        console.error('[DerivConnection] Failed to unsubscribe:', error);
      }
    }

    this.subscriptions.delete(subId);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;

      // Log errors
      if (message.error) {
        console.error('[DerivConnection] API error:', message.error);
      }

      // Handle request/response by req_id
      if (typeof message.req_id === 'number') {
        const pending = this.pendingRequests.get(message.req_id);
        if (pending) {
          this.pendingRequests.delete(message.req_id);

          if (message.error) {
            const error = message.error as { message?: string; code?: string };
            pending.reject(new Error(error.message || 'API request failed'));
          } else {
            pending.resolve(message);
          }
        }
      }

      // Handle subscription updates
      if (message.subscription && typeof message.subscription === 'object') {
        const subscription = message.subscription as { id?: number };
        if (typeof subscription.id === 'number') {
          // Find subscription by subscriptionId and call its callback
          for (const [, handler] of this.subscriptions) {
            if (handler.subscriptionId === subscription.id) {
              try {
                handler.callback(message);
              } catch (error) {
                console.error('[DerivConnection] Subscription callback error:', error);
              }
              break;
            }
          }
        }
      }

    } catch (error) {
      console.error('[DerivConnection] Failed to parse message:', error);
    }
  }

  /**
   * Close the WebSocket connection
   * **Validates: Requirement 2.5**
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset reconnect attempts to prevent reconnection
    this.reconnectAttempts = this.maxReconnectAttempts;

    // Unsubscribe from all subscriptions
    for (const [subId] of this.subscriptions) {
      this.unsubscribe(subId);
    }

    // Reject all pending requests
    const error = new Error('Connection closed by client');
    this.pendingRequests.forEach(req => req.reject(error));
    this.pendingRequests.clear();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuthorized = false;
  }

  /**
   * Check if connection is active and authorized
   */
  isConnected(): boolean {
    return this.ws !== null && 
           this.ws.readyState === WebSocket.OPEN && 
           this.isAuthorized;
  }

  /**
   * Get connection state for debugging
   */
  getConnectionState(): {
    connected: boolean;
    authorized: boolean;
    reconnectAttempts: number;
    pendingRequests: number;
    activeSubscriptions: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      authorized: this.isAuthorized,
      reconnectAttempts: this.reconnectAttempts,
      pendingRequests: this.pendingRequests.size,
      activeSubscriptions: this.subscriptions.size
    };
  }
}
