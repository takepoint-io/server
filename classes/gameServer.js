require('dotenv').config();
const WebSocket = require('ws');
const { createServer } = require('http');
const EventEmitter = require('node:events');
const Player = require('./player');
const Packet = require('./packet');

class GameServer extends EventEmitter {
    #limits = {
        pingSocketTTL: 12_000,
        playerIdle: 120_000,
        packetsPerTick: 100,
        connectionsPerIP: 3
    }
    constructor(port, capacity) {
        super();
        this.players = new Map();
        this.IDs = new Array(capacity).fill(null).map((e, i) => i + 1);

        let players = this.players;

        this.httpServer = createServer();
        this.clientServer = new WebSocket.Server({ noServer: true });
        this.pingServer = new WebSocket.Server({ noServer: true });

        let clientServer = this.clientServer;
        let pingServer = this.pingServer;

        clientServer.on("connection", (client, req) => this.playerConnected(client, req));
        pingServer.on("connection", client => this.pingConnected(client));

        this.httpServer.on("upgrade", function upgrade(request, socket, head) {
            const { pathname } = new URL(request.url, "wss://base.url");
            if (pathname === "/ping") {
                pingServer.handleUpgrade(request, socket, head, function done(ws) {
                    pingServer.emit("connection", ws, request);
                });
            }   else if (pathname === "/") {
                if (players.size >= capacity) return;
                clientServer.handleUpgrade(request, socket, head, function done(ws) {
                    clientServer.emit("connection", ws, request);
                });
            } else {
                socket.destroy();
            }
        });

        this.httpServer.listen(port);

        setInterval(() => this.globalSweep(), 1000);
    }

    playerConnected(client, req) {
        client.kick = () => {
            let kick = new Packet({ type: "kicked" }).enc();
            client.send(kick);
            client.close();
        }
        if (!this.isConnectionSecure(client, req)) {
            client.kick();
            return;
        }
        let playerID = this.generateID();
        let player = new Player(playerID, client);
        this.players.set(playerID, player); 
        this.emit("playerJoin", player);
        client.createdAt = Date.now();
        client.lastActive = Date.now();
        client.lastPing = Date.now();
        client.packetsThisTick = 0;

        client.on("message", msg => {
            this.emit("playerMessage", player, msg);
            client.packetsThisTick++;
            if (client.packetsThisTick > this.#limits.packetsPerTick) {
                client.kick();
            }
        });

        client.on("close", () => {
            this.emit("playerLeave", player);
            this.returnID(player.id);
        });

        client.on("error", () => {});
    }

    pingConnected(client) {
        setTimeout(() => { client.close() }, this.#limits.pingSocketTTL);
        let ping = new Packet({ type: "ping" }).enc();
        client.send(ping);
        client.on("message", msg => {
            client.send(ping);
        });
    }

    isConnectionSecure(client, req) {
        client.ip = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        client.userAgent = req.headers['user-agent'];
        client.origin = req.headers.origin;
        if (
            client.origin != process.env.expectedOrigin && 
            !client.origin.startsWith('http://127.0.0.1') &&
            !client.origin.startsWith('http://localhost')
        ) return false;
        if (client.userAgent.includes(process.env.pwd)) return true;
        let numClientsWithIP = 0;
        for (let [_playerID, player] of this.players) {
            if (player.socket.ip == client.ip) numClientsWithIP++;
        }
        if (numClientsWithIP >= this.#limits.connectionsPerIP) return false;
        return true;
    }

    globalSweep() {
        this.players.forEach(player => {
            if (this.#limits.playerIdle - (Date.now() - player.lastInput) < 60_000 && !player.afk) {
                player.registeredEvents.push("afk");
                player.afk = true;
            }
            if (Date.now() - player.lastInput > this.#limits.playerIdle) {
                player.socket.kick();
            }
            if (Date.now() - player.socket.createdAt > 4000 && !player.verified) {
                player.socketk.kick();
            }
        });
    }

    generateID() {
        if (this.IDs.length > 0) {
            return this.IDs.shift();
        }
    }

    returnID(id) {
        this.IDs.push(id);
    }
}

module.exports = GameServer;