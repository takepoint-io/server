const { worldValues } = require('../data/values.json');
const Util = require('./util');

class Bullet {
    static bulletIDs = new Array(worldValues.maxEntities.bullets).fill(null).map((e, i) => i + 1);
    static bullets = new Map();
    constructor(player, angle) {
        this.id = Bullet.getBulletID();
        this.type = 2;
        this.teamCode = player.teamCode;
        this.ownerID = player.id;
        this.createdAt = Date.now();
        this.parentWeapon = player.weapon;
        this.angle = angle;
        this.baseSpeed = this.parentWeapon.bulletSpeed;
        this.velocity = {
            x: Math.floor(Math.cos(Util.toRadians(this.angle)) * this.baseSpeed) + player.spdX,
            y: Math.floor(Math.sin(Util.toRadians(this.angle)) * this.baseSpeed) + player.spdY
        };
        this.size = this.parentWeapon.bulletSize;
        this.x = this.parentWeapon.x;
        this.y = this.parentWeapon.y;
        this.spawnedAt = {
            x: this.x,
            y: this.y
        };
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

    get dmg() {
        return this.parentWeapon.damage - Math.floor(this.distanceFromSpawn / this.parentWeapon.damageDropDistance);
    }

    tick() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        if (this.distanceFromSpawn >= this.parentWeapon.range) this.shouldDespawn = true;
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
}

module.exports = Bullet;