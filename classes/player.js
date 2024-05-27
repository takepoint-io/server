class Player {
    constructor(id, socket) {
        this.id = id;
        this.socket = socket;

        this.spawned = false;
        this.spawnProt = false;
        this.health = 0;
        this.shield = 0
    }

    sendUpdate(packet) {
        this.socket.send(packet);
    }
}

module.exports = Player;