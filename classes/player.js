class Player {
    constructor(id, socket) {
        this.id = id;
        this.socket = socket;
        
        this.spawnTimeout = 0;
        this.spawned = false;
        this.spawnProt = false;
        this.health = 0;
        this.shield = 0;
        this.x = 0;
        this.y = 0;
        this.spdX = 0;
        this.spdY = 0;
        this.weapon = {
            id: 0,
            ammo: 0
        };
        this.teamCode = 0;
        this.team = null;
        this.registeredEvents = [];

        this.username = "";
        this.guestName = "";
        this.loggedIn = false;

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
        this.lastInput = Date.now();
    }

    resetInputs() {
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