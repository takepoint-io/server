class Player {
    constructor(id, socket) {
        this.id = id;
        this.socket = socket;

        this.spawnTimeout = 0;
        this.spawned = false;
        this.spawnProt = false;
        this.health = 0;
        this.shield = 0;
        this.weapon = {
            id: 0,
            ammo: 0
        };
        this.registeredEvents = [];

        this.mouse = {
            x: 0,
            y: 0,
            angle: Math.floor(Math.random() * 360)
        };
        this.inputs = {
            left: false,
            right: false,
            up: false,
            down: false,
            reload: false,
            space: false,
            mouse: false
        };
    }

    sendUpdate(packet) {
        this.socket.send(packet);
    }
}

module.exports = Player;