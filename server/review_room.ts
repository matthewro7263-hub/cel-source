import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getSessionUser, storage } from "./storage";

interface ReviewClientMeta {
  projectId: number;
  userId: number;
}

const rooms = new Map<number, Set<WebSocket>>();

function canAccessProject(projectId: number, userId: number): boolean {
  const project = storage.getProject(projectId);
  if (!project) return false;
  if (project.ownerId === userId) return true;
  return storage.isMember(projectId, userId);
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
    const token = url.searchParams.get("token") || undefined;
    const userId = getSessionUser(token);
    if (!userId || !canAccessProject(projectId, userId)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { projectId, userId } satisfies ReviewClientMeta);
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
