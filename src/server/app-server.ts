import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import {
  HealthCheckQuerySchema,
  HttpCreateEventSchema,
  invalidPayloadError,
  makeError,
} from '../shared/protocol';
import { attachSocketHandlers } from './socket';
import { EventStore } from './store';

export type NextHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > 65536) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export interface ResonanceServerInstance {
  httpServer: http.Server;
  io: SocketIOServer;
  store: EventStore;
}

export function createResonanceServer(nextHandler?: NextHandler): ResonanceServerInstance {
  const store = new EventStore();

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (url.pathname === '/api/health') {
        if (req.method !== 'GET') {
          sendJson(res, 405, makeError('METHOD_NOT_ALLOWED', 'Only GET is allowed on /api/health'));
          return;
        }
        const queryObj = Object.fromEntries(url.searchParams.entries());
        const parsedQuery = HealthCheckQuerySchema.safeParse(queryObj);
        if (!parsedQuery.success) {
          sendJson(res, 400, invalidPayloadError(parsedQuery.error.issues[0]?.message ?? 'Invalid query'));
          return;
        }
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (url.pathname === '/api/events') {
        if (req.method !== 'POST') {
          sendJson(res, 405, makeError('METHOD_NOT_ALLOWED', 'Only POST is allowed on /api/events'));
          return;
        }
        let rawBody: unknown;
        try {
          rawBody = await readJsonBody(req);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Invalid JSON payload';
          sendJson(res, 400, invalidPayloadError(msg));
          return;
        }
        const parsed = HttpCreateEventSchema.safeParse(rawBody);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          sendJson(res, 400, invalidPayloadError(issue?.message ?? 'Invalid payload'));
          return;
        }
        const eventId = parsed.data.eventId ?? store.generateEventId(5);
        store.getOrCreateEvent(eventId);
        sendJson(res, 201, { eventId });
        return;
      }

      if (nextHandler) {
        await nextHandler(req, res);
        return;
      }
      sendJson(res, 404, makeError('NOT_FOUND', 'Route not found'));
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, makeError('INTERNAL_ERROR', 'Unexpected server error'));
      }
    }
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  attachSocketHandlers(io, store);

  return { httpServer, io, store };
}
