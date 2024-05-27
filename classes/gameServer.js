const WebSocket = require('ws');
const { createServer } = require('http');
const EventEmitter = require('node:events');
const Player = require('./player');
const Packet = require('./packet');

class GameServer extends EventEmitter {
    #pingSocketTTL = 12000;
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
    }

    playerConnected(client) {
        let playerID = this.generateID();
        let player = new Player(playerID, client);
        this.players.set(playerID, player); 
        this.emit("playerJoin", player);

        client.on("close", () => {
            this.players.delete(playerID);
        });
    }

    pingConnected(client) {
        setTimeout(() => { client.close() }, this.#pingSocketTTL);
        let ping = new Packet({ type: "ping" }).enc();
        client.send(ping);
        client.on("message", msg => {
            client.send(ping);
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