/**
 * Unit tests for DerivConnection
 * These tests verify the basic connection setup, authorization, and request/response flow
 * **Validates: Requirements 2.1, 2.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DerivConnection } from './deriv-connection';
import WebSocket from 'ws';

// Mock the ws module
vi.mock('ws', () => {
  const EventEmitter = require('events');
  
  class MockWebSocket extends EventEmitter {
    public readyState: number = WebSocket.CONNECTING;
    public CONNECTING = WebSocket.CONNECTING;
    public OPEN = WebSocket.OPEN;
    public CLOSING = WebSocket.CLOSING;
    public CLOSED = WebSocket.CLOSED;
    
    constructor(public url: string) {
      super();
      // Simulate connection opening after a short delay
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        this.emit('open');
      }, 10);
    }
    
    send(data: string): void {
      // Simulate response from Deriv API
      setTimeout(() => {
        const request = JSON.parse(data);
        let response: any = { req_id: request.req_id };
        
        // Mock authorize response
        if (request.authorize) {
          response.authorize = {
            loginid: 'TEST123',
            currency: 'USD',
          };
        }
        // Mock proposal response
        else if (request.proposal) {
          response.proposal = {
            id: 'test-proposal-id',
            ask_price: request.amount,
            payout: request.amount * 1.95,
          };
        }
        // Mock buy response
        else if (request.buy) {
          response.buy = {
            contract_id: 12345,
            buy_price: 1.0,
            payout: 1.95,
          };
        }
        
        this.emit('message', Buffer.from(JSON.stringify(response)));
      }, 10);
    }
    
    close(): void {
      this.readyState = WebSocket.CLOSED;
      this.emit('close', 1000, Buffer.from('Normal closure'));
    }
  }
  
  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };
});

describe('DerivConnection - Task 5.1', () => {
  let connection: DerivConnection;
  const testToken = 'test-api-token-12345';

  beforeEach(() => {
    connection = new DerivConnection(testToken);
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.disconnect();
    }
  });

  describe('Basic Connection Setup (Requirement 2.1)', () => {
    it('should connect to Deriv WebSocket API', async () => {
      await connection.connect();
      
      expect(connection.isConnected()).toBe(true);
      
      const state = connection.getConnectionState();
      expect(state.connected).toBe(true);
    });

    it('should only create one connection when connect is called multiple times', async () => {
      // Call connect multiple times
      const promise1 = connection.connect();
      const promise2 = connection.connect();
      const promise3 = connection.connect();
      
      await Promise.all([promise1, promise2, promise3]);
      
      expect(connection.isConnected()).toBe(true);
    });
  });

  describe('Authorization Flow (Requirement 2.2)', () => {
    it('should authorize immediately after connection', async () => {
      await connection.connect();
      
      const state = connection.getConnectionState();
      expect(state.authorized).toBe(true);
    });

    it('should reject requests before authorization', async () => {
      const unauthorizedConnection = new DerivConnection(testToken);
      
      // Try to make a request without connecting first
      await expect(
        unauthorizedConnection.request({ balance: 1 })
      ).rejects.toThrow('WebSocket is not connected');
    });
  });

  describe('request<T>() Method (Requirement 2.2)', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should send request and receive response with unique req_id', async () => {
      const response = await connection.request<{
        proposal?: { id: string; ask_price: number; payout: number };
      }>({
        proposal: 1,
        amount: 10,
        basis: 'stake',
        contract_type: 'CALL',
        currency: 'USD',
        duration: 1,
        duration_unit: 't',
        underlying_symbol: 'R_100',
      });

      expect(response.proposal).toBeDefined();
      expect(response.proposal?.id).toBe('test-proposal-id');
      expect(response.proposal?.ask_price).toBe(10);
      expect(response.proposal?.payout).toBe(19.5);
    });

    it('should handle multiple concurrent requests with different req_ids', async () => {
      const requests = [
        connection.request({ proposal: 1, amount: 5 }),
        connection.request({ proposal: 1, amount: 10 }),
        connection.request({ proposal: 1, amount: 15 }),
      ];

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(3);
      expect(responses[0]).toHaveProperty('proposal');
      expect(responses[1]).toHaveProperty('proposal');
      expect(responses[2]).toHaveProperty('proposal');
    });

    it('should resolve promises with correct responses using req_id mapping', async () => {
      const response1 = connection.request<{
        proposal?: { ask_price: number };
      }>({ proposal: 1, amount: 5 });
      
      const response2 = connection.request<{
        proposal?: { ask_price: number };
      }>({ proposal: 1, amount: 10 });

      const [res1, res2] = await Promise.all([response1, response2]);

      // Each response should have the correct ask_price matching the request
      expect(res1.proposal?.ask_price).toBe(5);
      expect(res2.proposal?.ask_price).toBe(10);
    });

    it('should timeout requests that take too long', async () => {
      // Create a connection that never responds
      const slowConnection = new DerivConnection(testToken);
      await slowConnection.connect();

      // Mock send to not trigger any response
      const originalSend = (slowConnection as any).ws.send;
      (slowConnection as any).ws.send = vi.fn();

      const requestPromise = slowConnection.request({ balance: 1 });

      await expect(requestPromise).rejects.toThrow(/timed out/);
      
      await slowConnection.disconnect();
    }, 35000); // Increase timeout for this test
  });

  describe('Message Routing', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    it('should store pending requests in Map with req_id as key', async () => {
      // Start a request but don't await it yet
      const requestPromise = connection.request({ proposal: 1, amount: 10 });

      // Check connection state while request is pending
      const state = connection.getConnectionState();
      expect(state.pendingRequests).toBeGreaterThan(0);

      // Now await the response
      await requestPromise;

      // After response, pending request should be cleared
      const finalState = connection.getConnectionState();
      expect(finalState.pendingRequests).toBe(0);
    });
  });

  describe('Connection State', () => {
    it('should report not connected initially', () => {
      expect(connection.isConnected()).toBe(false);
    });

    it('should report connected after successful connection', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    });

    it('should provide connection state for debugging', async () => {
      // Create a fresh connection for this test
      const freshConnection = new DerivConnection(testToken);
      const initialState = freshConnection.getConnectionState();
      expect(initialState.authorized).toBe(false);
      expect(initialState.pendingRequests).toBe(0);

      await freshConnection.connect();

      const connectedState = freshConnection.getConnectionState();
      expect(connectedState.connected).toBe(true);
      expect(connectedState.authorized).toBe(true);
      
      await freshConnection.disconnect();
    });
  });

  describe('Disconnection', () => {
    it('should disconnect cleanly', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    });

    it('should reject pending requests on disconnect', async () => {
      await connection.connect();

      // Mock send to prevent response
      (connection as any).ws.send = vi.fn();

      const requestPromise = connection.request({ balance: 1 });

      // Disconnect before response arrives
      await connection.disconnect();

      await expect(requestPromise).rejects.toThrow('Connection closed');
    });
  });
});
