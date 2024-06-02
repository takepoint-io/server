const Weapon = require("./weapon");
const Util = require("./util");

class Player {
    constructor(id, socket) {
        this.id = id;
        this.type = 0; //players are type 0. objects will be type 1, and bullets will be type 2.
        this.socket = socket;
        
        this.loadingScreenDir = 0;
        this.spawnTimeout = 0;
        this.spawned = false;
        this.spawnProt = 0;
        this.radius = 25;
        this.health = 0;
        this.shield = 0;
        this.maxHealth = 100;
        this.maxShield = 100;
        this.x = 0;
        this.y = 0;
        this.spdX = 0;
        this.spdY = 0;
        this.viewbox = {
            x: 1468,
            y: 826
        };
        this.playerPool = new Map();
        this.objectPool = new Map();
        this.bulletPool = new Map();
        this.angle = Math.floor(Math.random() * 360);
        this.upgrades = {
            speed: 0,
            reload: 0,
            mags: 0,
            view: 0, //each level expands viewbox by * 1.1
            regen: 0
        };
        this.score = 0;
        this.kills = 0;
        this.level = 0;
        this.weapon = new Weapon("pistol", this); 
        this.teamCode = 0;
        this.team = null;
        this.registeredEvents = [];
        this.updatedFields = new Map();

        this.username = "";
        this.guestName = "";
        this.loggedIn = false;

        this.mouse = {
            x: 0,
            y: 0,
            angle: 0
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

    get maxSpeed() {
        return this.upgrades.speed + (this.weapon.name == "pistol" ? 13: 10);
    }

    get numInputs() {
        return this.inputs.left + this.inputs.right + this.inputs.up + this.inputs.down;
    }

    get inputDirX() {
        return !this.inputs.left && this.inputs.right ? 1 : this.inputs.left && !this.inputs.right ? -1 : 2;
    }

    get inputDirY() {
        return !this.inputs.up && this.inputs.down ? 1 : this.inputs.up && !this.inputs.down ? -1 : 2;
    }

    normalizeSpeed() {
        let magnitude = Util.hypot(this.spdX, this.spdY);
        if (magnitude > this.maxSpeed) {
            let spdX = this.spdX / magnitude;
            let spdY = this.spdY / magnitude;
            this.spdX = spdX * this.maxSpeed;
            this.spdY = spdY * this.maxSpeed;
        }
    }

    respawn(world) {
        this.resetInputs();
        [this.x, this.y] = world.getSpawnPoint(this.teamCode);
        this.spdX = 0;
        this.spdY = 0;
        this.health = this.maxHealth;
        this.shield = this.maxShield;
        this.score = Math.floor(this.score / 4);
        this.kills = 0;
        this.weapon = new Weapon("pistol", this);
        this.spawnProt = 1;
        this.spawned = true;
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