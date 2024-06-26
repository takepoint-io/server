const { worldValues } = require('../data/values.json');
const Util = require('./util');

class Bullet {
    constructor(player, angle, customData) {
        this.id = Bullet.getBulletID();
        this.type = 2;
        this.teamCode = player.teamCode;
        this.ownerID = player.id;
        this.createdAt = Date.now();
        this.isCustom = customData ? 1 : 0;
        this.parentWeapon = this.isCustom ? customData.weapon : player.weapon;
        this.player = player;
        this.angle = Math.round(angle);
        this.baseSpeed = this.parentWeapon.bulletSpeed;
        this.velocity = {
            x: Math.floor(Math.cos(Util.toRadians(this.angle)) * this.baseSpeed + (this.isCustom ? 0 : player.spdX)) || 0,
            y: Math.floor(Math.sin(Util.toRadians(this.angle)) * this.baseSpeed + (this.isCustom ? 0 : player.spdY)) || 0
        };
        this.size = this.parentWeapon.bulletSize;
        this.timeToLive = this.parentWeapon.range;
        this.x = this.parentWeapon.x + this.player.spdX;
        this.y = this.parentWeapon.y + this.player.spdY;
        this.spawnedAt = {
            x: this.x,
            y: this.y
        };
        this.spawned = true;
        Bullet.bullets.set(this.id, this);
    }

    get rX() {
        return Math.round(this.x);
    }

    get rY() {
        return Math.round(this.y);
    }

    get rSpdX() {
        return Math.round(this.velocity.x);
    }

    get rSpdY() {
        return Math.round(this.velocity.y)
    }

    get distanceFromSpawn() {
        return Util.hypot((this.x + this.velocity.x) - this.spawnedAt.x, (this.y + this.velocity.y) - this.spawnedAt.y);
    }

    get distanceFromPlayer() {
        return Util.hypot((this.x + this.velocity.x) - this.player.x, (this.y + this.velocity.y) - this.player.y);
    }

    get dmg() {
        return this.parentWeapon.damage - Math.floor(this.distanceFromSpawn / this.parentWeapon.damageDropDistance);
    }

    tick() {
        this.timeToLive--;
        if (this.timeToLive == 0 || Util.hypot(this.x + this.velocity.x, this.y + this.velocity.y) > 4250) this.shouldDespawn = true;
        if (this.shouldDespawn) this.despawn();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    despawn() {
        Bullet.bullets.delete(this.id);
        Bullet.returnBulletID(this.id);
        this.spawned = false;
    }

    static getBulletID() {
        if (Bullet.bulletIDs.length > 0) {
            return Bullet.bulletIDs.shift();
        } else {
            let oldest = Infinity;
            for (let [_id, bullet] of Bullet.bullets) {
                if (bullet.createdAt < oldest) oldest = bullet.createdAt;
            }
            return oldest.id;
        }
    }

    static returnBulletID(id) {
        Bullet.bulletIDs.push(id);
    }

    static init() {
        Bullet.bulletIDs = new Array(worldValues.maxEntities.bullets).fill(null).map((e, i) => i + 1);
        Bullet.bullets = new Map();
    }
}

module.exports = Bullet;