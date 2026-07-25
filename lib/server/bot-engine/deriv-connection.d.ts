/**
 * DerivConnection - Server-side WebSocket connection manager for Deriv API
 *
 * This class manages persistent WebSocket connections to Deriv's trading API.
 * It handles connection lifecycle, authorization, message routing, and request/response patterns.
 *
 * **Validates: Requirements 2.1, 2.2**
 */
export declare class DerivConnection {
    private ws;
    private apiToken;
    private url;
    private pendingRequests;
    private subscriptions;
    private nextReqId;
    private nextSubId;
    private isAuthorized;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectTimer;
    private connectionPromise;
    constructor(apiToken: string);
    /**
     * Connect to Deriv WebSocket API and authorize
     * **Validates: Requirements 2.1, 2.2**
     */
    connect(): Promise<void>;
    private _connect;
    /**
     * Authorize the connection using the API token
     * **Validates: Requirement 2.2**
     */
    private authorize;
    /**
     * Schedule reconnection with exponential backoff
     * **Validates: Requirement 2.3, 2.4**
     */
    private scheduleReconnect;
    /**
     * Send a request and wait for response
     * **Validates: Requirements 2.1, 2.2**
     */
    request<T>(payload: Record<string, unknown>): Promise<T>;
    /**
     * Subscribe to a stream and register a callback handler
     */
    subscribe(payload: Record<string, unknown>, callback: (data: unknown) => void): number;
    /**
     * Unsubscribe from a stream
     */
    unsubscribe(subId: number): void;
    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage;
    /**
     * Close the WebSocket connection
     * **Validates: Requirement 2.5**
     */
    disconnect(): Promise<void>;
    /**
     * Check if connection is active and authorized
     */
    isConnected(): boolean;
    /**
     * Get connection state for debugging
     */
    getConnectionState(): {
        connected: boolean;
        authorized: boolean;
        reconnectAttempts: number;
        pendingRequests: number;
        activeSubscriptions: number;
    };
}
//# sourceMappingURL=deriv-connection.d.ts.map