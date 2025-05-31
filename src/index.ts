import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import http, { IncomingMessage } from "http";
import Hyperswarm from "hyperswarm";
import crypto from "crypto";
import net from "net";


dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

// --- Express Setup ---
const app = express();
const server: http.Server = http.createServer(app);
const PORT: number = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

app.get("/health", (req: Request, res: Response): void => {
  res.send({ status: "ok" });
});

// --- WebSocket Setup ---
const wss = new WebSocketServer({ server });
const browserClients: Set<WebSocket> = new Set();

wss.on("connection", (ws: WebSocket, req: IncomingMessage): void => {
  console.log("🌍 Browser connected");
  browserClients.add(ws);

  ws.on("message", (msg: string | Buffer): void => {
    console.log("📨 From browser:", msg.toString());

    for (const peer of swarmPeers) {
      peer.write(msg);
    }

    // Broadcast to all sockets in the same room (that are connected to the same backend)
    browserClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg.toString());
      }
    });
  });

  ws.on("close", (): void => {
    browserClients.delete(ws);
  });
});

// --- Hyperswarm Setup ---
const swarm = new Hyperswarm();
const topic: Buffer = crypto.createHash("sha256").update("chat-room").digest();

const swarmPeers: Set<net.Socket> = new Set();

swarm.on("connection", (socket: net.Socket, details: any): void => {
  console.log("🔌 Connected to Hyperswarm peer");
  swarmPeers.add(socket);

  socket.on("data", (data: Buffer): void => {
    for (const ws of browserClients) {
      ws.send(data.toString());
    }
  });

  socket.on("close", (): void => {
    swarmPeers.delete(socket);
  });
});

swarm.join(topic, { lookup: true, announce: true });

// --- Start Server ---
server.listen(PORT, (): void => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
