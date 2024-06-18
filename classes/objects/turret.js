const Obj = require('./obj');
const Bullet = require('../bullet');
const Util = require('../util');
const { worldValues: { perks: { turret } } } = require('../../data/values.json');

class Turret extends Obj {
    static cooldown = turret.cooldown * 25;
    static radius = turret.radius;
    static bulletSpeed = turret.bulletSpeed;
    static rotationSpeed = turret.rotationSpeed;
    static range = turret.range;
    static dmg = turret.damage;
    static dmgDrop = turret.damageDrop;
    static ticksBeforeFire = turret.ticksBeforeFire;
    static passiveRotationSpeed = turret.passiveRotationSpeed;
    static firingRadius = 50;
    constructor(x, y, player, world) {
        super(2, x, y, turret.radius, turret.maxHealth, player.teamCode, turret.lifespan * 25);
        this.ticksSinceFire = Turret.ticksBeforeFire;
        this.player = player;
        this.angle = player.angle;
        this.world = world;
    }

    tick() {
        super.tick();
        this.updatedThisTick = true;
        let playersNearby = this.world.queryPlayers(this.x, this.y, Turret.range + Turret.firingRadius + 50)
            .map(p => this.world.players.get(p.data.id))
            .filter(p => p.inGame && !p.spawnProt && p.teamCode != this.teamCode && Util.distance(p, this) < Turret.range + Turret.firingRadius);
        if (!playersNearby.length) {
            this.angle = (this.angle + Turret.passiveRotationSpeed) % 360;
            return;
        } 
        let closest = { player: null, dist: Infinity };
        for (let i = 0; i < playersNearby.length; i++) {
            let dist = Util.distance(playersNearby[i], this);
            if (dist < closest.dist) {
                closest.dist = dist;
                closest.player = playersNearby[i];
            } 
        }
        let angleToPlayer = Util.angle(closest.player.x - this.x, closest.player.y - this.y);
        this.rotateTowards(angleToPlayer);
        if (this.ticksSinceFire >= Turret.ticksBeforeFire) {
            this.ticksSinceFire = 0;
            let spawnPoint = Util.circlePoint(this.angle, this, Turret.firingRadius);
            new Bullet(this.player, this.angle, {
                weapon: {
                    bulletSpeed: Turret.bulletSpeed,
                    bulletSize: 2,
                    id: 1,
                    range: Turret.range,
                    damage: Turret.dmg,
                    damageDropDistance: Turret.dmgDrop,
                    x: spawnPoint.x,
                    y: spawnPoint.y,
                    isPerk: true
                }
            });
        }
        this.ticksSinceFire++;
    }

    rotateTowards(targetAngle) {
        let diff = (targetAngle - this.angle + 540) % 360 - 180;
        let amountToRotate = Math.min(Math.abs(diff), Turret.rotationSpeed) * Math.sign(diff);
        this.angle = Math.round((this.angle + amountToRotate) % 360);
    }
}

module.exports = Turret;