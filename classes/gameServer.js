const WebSocket = require('ws')

class GameServer {
    constructor(port) {
        this.socketServer = new WebSocket.Server(port);
    }
}

module.exports = GameServer