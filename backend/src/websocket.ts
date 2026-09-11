import { Server } from 'http';
import WebSocket, { Server as WebSocketServer } from 'ws';

let wss: WebSocketServer;

export const initWebSocket = (server: Server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('error', (err) => {
      // Prevent unhandled error event crashes
      console.warn('[WS] Client socket error:', err.message);
    });

    ws.on('close', () => {
      // Disconnected
    });
  });
};

export const broadcast = (data: any) => {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};
