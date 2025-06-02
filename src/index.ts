import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Hyperswarm from "hyperswarm";
import crypto from "crypto";
import net from "net";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

app.get("/health", (req: Request, res: Response): void => {
  res.send({ status: "ok" });
});

const wss = new WebSocketServer({ server });
const swarm = new Hyperswarm();

let room: string | null = null;
let topic: Buffer | null = null;
let browserClient: WebSocket | null = null;
const swarmPeers = new Set<net.Socket>();

wss.on("connection", (ws: WebSocket): void => {
  console.log("🌍 Browser connected");
  browserClient = ws;

  ws.on("message", (rawMsg: string | Buffer): void => {
    try {
      const msg = JSON.parse(rawMsg.toString());
      console.log("📨 From browser:", msg);
      // Initial room join
      if (msg.type === "join" && typeof msg.room === "string") {
        room = msg.room.trim();
        if (!room) {
          console.error("❌ Invalid room name");
          return;
        }
        topic = crypto.createHash("sha256").update(room).digest();

        swarm.join(topic, { lookup: true, announce: true });
        console.log(`✅ Joined room swarm: ${room}`);
        return;
      }

      // Forward chat messages to all connected peers
      const textMsg = JSON.stringify(msg);
      for (const peer of swarmPeers) {
        peer.write(textMsg);
      }

      // Broadcast to all sockets in the same room (that are connected to the same backend)
      if (browserClient?.readyState === WebSocket.OPEN) {
        browserClient.send(textMsg);
      }
    } catch (err) {
      console.error("💥 Failed to parse message:", err);
    }
  });

  ws.on("close", (): void => {
    console.log("❌ Browser disconnected");
    browserClient = null;
  });
});

// Handle Hyperswarm peer connections
swarm.on("connection", (socket: net.Socket): void => {
  console.log("🔌 Hyperswarm peer connected");
  swarmPeers.add(socket);
  broadcastPeerCount();

  socket.on("data", (data: Buffer): void => {
    if (browserClient && browserClient.readyState === WebSocket.OPEN) {
      browserClient.send(data.toString());
    }
  });

  socket.on("close", (): void => {
    console.log("🔌 Hyperswarm peer disconnected");
    swarmPeers.delete(socket);
  });
});

swarm.on("peer", (peer: any): void => {
  console.log("🔍 Peer discovered:", peer);
});

swarm.on("error", (err: Error): void => {
  console.error("❗ Hyperswarm error:", err);
});

server.listen(PORT, (): void => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const broadcastPeerCount = () => {
  if (browserClient && browserClient.readyState === WebSocket.OPEN) {
    browserClient.send(
      JSON.stringify({ type: "peer_count", count: swarmPeers.size })
    );
  }
};
