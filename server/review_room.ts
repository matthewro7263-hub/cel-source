import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { randomBytes } from "node:crypto";
import type { Express } from "express";
import { canAccessProject, requireAuth } from "./auth";

interface ReviewClientMeta {
  projectId: number;
  userId: number;
}

const rooms = new Map<number, Set<WebSocket>>();

// Short-lived, single-use tickets so the long-lived session token never
// appears in a WebSocket URL (which ends up in proxy/access logs).
const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, { projectId: number; userId: number; expiresAt: number }>();

function issueTicket(projectId: number, userId: number): string {
  const now = Date.now();
  for (const [t, v] of tickets) if (now >= v.expiresAt) tickets.delete(t);
  const ticket = randomBytes(24).toString("hex");
  tickets.set(ticket, { projectId, userId, expiresAt: now + TICKET_TTL_MS });
  return ticket;
}

function consumeTicket(ticket: string | null, projectId: number): number | undefined {
  if (!ticket) return undefined;
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || Date.now() >= entry.expiresAt || entry.projectId !== projectId) return undefined;
  return entry.userId;
}

export function registerReviewRoomTicketRoute(app: Express) {
  app.post("/api/projects/:projectId/review-room/ticket", requireAuth, async (req, res) => {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!Number.isInteger(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await canAccessProject(projectId, req.user!.id))) return res.status(403).json({ message: "No access" });
    res.json({ ticket: issueTicket(projectId, req.user!.id), expiresIn: TICKET_TTL_MS / 1000 });
  });
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast(projectId: number, payload: unknown) {
  const clients = rooms.get(projectId);
  if (!clients) return;
  clients.forEach((client) => sendJson(client, payload));
}

function roomPresence(projectId: number) {
  return {
    type: "presence",
    count: rooms.get(projectId)?.size || 0,
    sentAt: new Date().toISOString(),
  };
}

export function registerReviewRoom(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "", `http://${host}`);
    const match = url.pathname.match(/^\/api\/projects\/(\d+)\/review-room$/);
    if (!match) return;

    const projectId = parseInt(match[1], 10);
    const ticket = url.searchParams.get("ticket");

    (async () => {
      const userId = consumeTicket(ticket, projectId);
      if (!userId || !(await canAccessProject(projectId, userId))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, { projectId, userId } satisfies ReviewClientMeta);
      });
    })().catch(() => {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, meta: ReviewClientMeta) => {
    const clients = rooms.get(meta.projectId) || new Set<WebSocket>();
    clients.add(ws);
    rooms.set(meta.projectId, clients);

    sendJson(ws, {
      type: "hello",
      userId: meta.userId,
      projectId: meta.projectId,
      sentAt: new Date().toISOString(),
    });
    broadcast(meta.projectId, roomPresence(meta.projectId));

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const allowed = new Set(["cursor", "stroke", "clear", "playhead", "panel", "note", "script-cursor"]);
        if (!allowed.has(parsed.type)) return;
        broadcast(meta.projectId, {
          ...parsed,
          userId: meta.userId,
          sentAt: new Date().toISOString(),
        });
      } catch {
        sendJson(ws, { type: "error", message: "Invalid review room message" });
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      if (clients.size === 0) rooms.delete(meta.projectId);
      broadcast(meta.projectId, roomPresence(meta.projectId));
    });
  });
}