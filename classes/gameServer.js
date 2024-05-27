const WebSocket = require('ws');
const { createServer } = require('http');
const EventEmitter = require('node:events');

class GameServer extends EventEmitter {
    #pingSocketTTL = 12000;
    constructor(port, capacity) {
        super();
        this.players = new Map();
        this.IDs = new Array(capacity);

        let players = this.players;

        this.httpServer = createServer();
        this.clientServer = new WebSocket.Server({ noServer: true });
        this.pingServer = new WebSocket.Server({ noServer: true });

        let clientServer = this.clientServer;
        let pingServer = this.pingServer;

        clientServer.on("connection", client => this.playerConnected(client));
        pingServer.on("connection", client => this.pingConnected(client));

        this.httpServer.on('upgrade', function upgrade(request, socket, head) {
            const { pathname } = new URL(request.url, 'wss://base.url');

            if (pathname === '/ping') {
                pingServer.handleUpgrade(request, socket, head, function done(ws) {
                    pingServer.emit('connection', ws, request);
                });
            }   else if (pathname === '/') {
                if (players.size < capacity) return;
                clientServer.handleUpgrade(request, socket, head, function done(ws) {
                    clientServer.emit('connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        });

        this.httpServer.listen(port);
    }

    playerConnected(client) {
        let playerID = this.generateID();
        this.players.push(client);
        this.emit("playerJoin");
    }

    pingConnected(client) {
        setTimeout(() => { client.close() }, this.#pingSocketTTL);
        client.send(GameServer.encodePacket("."));
        client.on('message', msg => {
            client.send(GameServer.encodePacket("."));
        });
    }

    generateID() {

    }

    static encodePacket(packet) {
        return new TextEncoder().encode(packet);
    }
}

module.exports = GameServer;