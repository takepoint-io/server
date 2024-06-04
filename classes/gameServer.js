const WebSocket = require('ws');
const { createServer } = require('http');
const EventEmitter = require('node:events');
const Player = require('./player');
const Packet = require('./packet');

class GameServer extends EventEmitter {
    #limits = {
        pingSocketTTL: 12 * 1000,
        playerIdle: 120 * 1000,
        packetsPerTick: 50
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

        clientServer.on("connection", client => this.playerConnected(client));
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

    playerConnected(client) {
        let playerID = this.generateID();
        let player = new Player(playerID, client);
        this.players.set(playerID, player); 
        this.emit("playerJoin", player);
        client.lastActive = Date.now();
        client.lastPing = Date.now();
        client.packetsThisTick = 0;

        client.on("message", msg => {
            this.emit("playerMessage", player, msg);
            client.packetsThisTick++;
            if (client.packetsThisTick > this.#limits.packetsPerTick) {
                client.close();
            }
        });

        client.on("close", () => {
            this.emit("playerLeave", player);
        });
    }

    pingConnected(client) {
        setTimeout(() => { client.close() }, this.#limits.pingSocketTTL);
        let ping = new Packet({ type: "ping" }).enc();
        client.send(ping);
        client.on("message", msg => {
            client.send(ping);
        });
    }

    globalSweep() {
        this.players.forEach(player => {
            //TODO: kick inactive players
            if (Date.now() - player.lastInput > this.#limits.playerIdle) {
                player.socket.close();
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