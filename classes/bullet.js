const SelfDestruct = require('./throwable/selfDestruct');
const Util = require('./util');
const { worldValues } = require('../data/values.json');

class Bullet {
    constructor(player, angle, customData) {
        this.id = Bullet.getBulletID();
        this.type = 2;
        this.teamCode = player.teamCode;
        this.ownerID = player.id;
        this.createdAt = Date.now();
        this.isCustom = customData ? 1 : 0;
        this.parentWeapon = this.isCustom ? customData.weapon : player.weapon;
        this.isExplosive = this.parentWeapon.explosiveBullets;
        this.isDrone = this.parentWeapon.droneBullets;
        this.player = player;
        this.angle = Math.round(angle);
        this.baseSpeed = this.parentWeapon.bulletSpeed;
        this.velocity = this.calcVelocity();
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
        return Math.max(this.parentWeapon.damage - Math.floor(this.distanceFromSpawn / this.parentWeapon.damageDropDistance), 0);
    }

    tick() {
        this.timeToLive--;
        if (this.timeToLive == 0 || Util.hypot(this.x + this.velocity.x, this.y + this.velocity.y) > 4250) this.shouldDespawn = true;
        if (this.shouldDespawn) this.despawn();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        if (this.isDrone) {
            let mouse = this.player.mouse;
            let tx = Util.clamp(-mouse.x, -550, 550) - this.x + this.player.x;
            let ty = Util.clamp(-mouse.y, -500, 500) - this.y + this.player.y;
            let targetAngle = Util.angle(tx, ty);
            this.angle = Util.rotateTowards(this.angle, targetAngle, 15);
            this.velocity = this.calcVelocity();
            let slownessFactor = Math.min(Util.hypot(tx, ty) / 100, 1);
            if (slownessFactor > 0.3) {
                this.velocity.x *= slownessFactor;
                this.velocity.y *= slownessFactor;
            }
        }
    }

    despawn() {
        Bullet.bullets.delete(this.id);
        Bullet.returnBulletID(this.id);
        this.spawned = false;
        if (this.isExplosive) {
            let world = this.player.worldRef;
            let ticks = 0;
            let bulletExplosion = new SelfDestruct(this.player, world, {
                isCustomExplosion: true, 
                tick: () => {
                    if (ticks == 0) {
                        bulletExplosion.x = this.x;
                        bulletExplosion.y = this.y;
                        bulletExplosion.detonated = 1;
                        bulletExplosion.radius = 40;
                        world.createExplosion(bulletExplosion.x, bulletExplosion.y, 120, this.player, 45, 10, 0);
                    } else if (ticks == 1) {
                        bulletExplosion.radius = 80;
                    } else if (ticks == 2) {
                        bulletExplosion.radius = 120;
                    } else {
                        bulletExplosion.despawn();
                    }
                    ticks++;
                }
            });
        }
    }

    calcVelocity() {
        return {
            x: Math.floor(Math.cos(Util.toRadians(this.angle)) * this.baseSpeed + (this.isCustom ? 0 : this.player.spdX)) || 0,
            y: Math.floor(Math.sin(Util.toRadians(this.angle)) * this.baseSpeed + (this.isCustom ? 0 : this.player.spdY)) || 0
        };
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