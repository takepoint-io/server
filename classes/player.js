const Weapon = require("./weapon");
const Packet = require("./packet");
const Util = require("./util");
const { worldValues: { levels, upgradesAtLevel } } = require('../data/values.json');

class Player {
    constructor(id, socket) {
        this.id = id;
        this.type = 0;
        this.socket = socket;
        this.packet = new Packet();
        
        this.loadingScreenDir = 0;
        this.inGame = false;
        this.dying = false;
        this.informedOfRespawn = true;
        this.spawnTimeout = 0;
        this.spawned = false;
        this.spawnProt = 0;
        this.beingHit = 0;
        this.radius = 25;
        this.health = 0;
        this.shield = 0;
        this.maxHealth = 100;
        this.maxShield = 100;
        this.accumulatedHealth = 0;
        this.x = 0;
        this.y = 0;
        this.spdX = 0;
        this.spdY = 0;
        this.resetViewbox();
        this.angle = Math.floor(Math.random() * 360);
        this.resetUpgrades();
        this.score = 0;
        this.kills = 0;
        this.level = 0;
        this.resetWeapon();
        this.resetPerk();
        this.teamCode = 0;
        this.team = null;
        this.collisions = [];
        this.registeredEvents = [];
        this.miscUpdates = new Map();
        this.formUpdates = new Map();

        this.username = "";
        this.guestName = "";
        this.loggedIn = 0;
        this.cookie = null;
        this.saveCookie = 0;

        this.mouse = {
            x: 0,
            y: 0,
            angle: 0
        };
        this.resetInputs();
        this.lastInput = Date.now();
        this.afk = false;
    }

    get rX() {
        return Math.round(this.x);
    }

    get rY() {
        return Math.round(this.y);
    }

    get rSpdX() {
        return Math.round(this.spdX);
    }

    get rSpdY() {
        return Math.round(this.spdY);
    }

    get maxSpeed() {
        return this.upgrades.speed * 0.5 + (this.weapon.name == "pistol" ? 10.5 : 8.5);
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

    get expectedLevel() {
        for (let i = levels.length - 1; i >= 0; i--) {
            if (this.score >= levels[i]) return i;
        }
        return 0;
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

    addScore(amount) {
        if (!this.spawned) return;
        this.score += amount;
        let expectedLevel = this.expectedLevel;
        if (this.level < expectedLevel) {
            this.level = expectedLevel;
            this.formUpdates.set("level", this.level);
            if (this.level >= this.skillPointsLevels[0]) {
                for (let i = 0; i < this.skillPointsLevels.length; i++) {
                    let req = this.skillPointsLevels[i];
                    if (this.level >= req) {
                        this.skillPoints++;
                        this.skillPointsLevels.shift();
                        i--;
                    }
                    else break;
                }
                this.formUpdates.set("skillPoints", this.skillPoints);
            }
            if (this.level >= upgradesAtLevel.gun && !this.weaponUpgradeAvailable && !this.weaponUpgradeSelected) {
                this.weaponUpgradeAvailable = 1;
                this.formUpdates.set("weaponUpgradeAvailable", this.weaponUpgradeAvailable);
            }
            if (this.level >= upgradesAtLevel.perk && !this.perkUpgradeAvailable && !this.perkUpgradeSelected) {
                this.perkUpgradeAvailable = 1;
                this.formUpdates.set("perkUpgradeAvailable", this.perkUpgradeAvailable);
            }
        }
        this.formUpdates.set("score", this.score);
        this.packet.serverMessage(Packet.createServerMessage("score", amount));
    }

    takeDamage(amount, from, scorable = true, minHealth = 0) {
        if (this.destructing) return;
        if (this.shield > 0) {
            this.shield = Util.clamp(this.shield - amount, 0, this.maxShield);
            this.miscUpdates.set("shield", this.shield);
        }
        if (this.shield == 0) {
            let tmpHealth = this.health;
            this.health = Util.clamp(this.health - amount, minHealth, this.maxHealth);
            this.miscUpdates.set("hp", this.health);
            this.beingHit = 1;
            this.miscUpdates.set("beingHit", this.beingHit);
            let delta = tmpHealth - this.health;
            if (delta > 0 && scorable) from.addScore(delta);
            if (this.health == 0) return true;
        }
    }

    respawn(world) {
        this.inGame = true;
        this.spawned = true;
        this.beingHit = 0;
        this.resetInputs();
        [this.x, this.y] = world.getSpawnPoint(this.teamCode);
        this.chainTimer = 0;
        this.chainLevel = 0;
        this.spdX = 0;
        this.spdY = 0;
        this.radius = 25;
        this.health = this.maxHealth;
        this.shield = this.maxShield;
        this.accumulatedHealth = 0;
        this.level = 0;
        this.destructing = 0;
        this.resetGameStats();
        this.resetSkillPoints();
        this.resetUpgrades();
        this.resetWeapon();
        this.resetPerk();
        this.resetViewbox();
        let tempScore = this.score;
        this.score = 0;
        if (tempScore > 0) this.addScore(Math.floor(tempScore / 4));
        this.kills = 0;
        this.spawnProt = 1;
    }

    resetGameStats() {
        this.stats = {
            spawnTime: Date.now(),
            bulletsFired: 0,
            bulletsHit: 0,
            pointsNeutralized: 0,
            pointsTaken: 0,
            get ticksAlive() {
                return Math.floor(this.timeAlive / 40);
            },
            get accuracy() {
                return this.bulletsFired == 0 ? "-" : (this.bulletsHit / this.bulletsFired * 100).toFixed(2);
            },
            doubleKills: 0,
            tripleKills: 0,
            multiKills: 0
        };
        this.stats.setTimeAlive = () => this.stats.timeAlive = Date.now() - this.stats.spawnTime;
    }

    resetSkillPoints() {
        this.skillPoints = 0;
        this.skillPointsLevels = upgradesAtLevel.skillPoints.slice();
    }

    resetUpgrades() {
        this.upgrades = {
            speed: 0,
            reload: 0,
            mags: 0,
            view: 0, //each level expands viewbox by * 1.1
            regen: 0
        };
    }

    resetPerk() {
        this.perkID = null;
        this.perkUpgradeAvailable = 0;
        this.perkUpgradeSelected = 0;
        this.maxCooldown = 0;
        this.currentCooldown = 0;
    }

    resetWeapon() {
        this.weapon = new Weapon("pistol", this);
        this.weaponUpgradeAvailable = 0;
        this.weaponUpgradeSelected = 0;
    }

    setWeapon(weaponName) {
        this.weapon = new Weapon(weaponName, this);
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
        this.keyDowns = [];
        this.keyUps = [];
    }

    resetViewbox() {
        this.viewbox = {
            x: 1468,
            y: 826
        };
        this.playerPool = new Map();
        this.objectPool = new Map();
        this.bulletPool = new Map();
        this.throwablePool = new Map();
    }

    sendUpdate(packet) {
        this.socket.send(packet);
    }
}

module.exports = Player;