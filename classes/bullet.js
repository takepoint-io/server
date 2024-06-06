const { worldValues } = require('../data/values.json');
const Util = require('./util');

class Bullet {
    static bulletIDs = new Array(worldValues.maxEntities.bullets).fill(null).map((e, i) => i + 1);
    static bullets = new Map();
    constructor(player, angle) {
        this.id = Bullet.getBulletID();
        this.teamCode = player.teamCode;
        this.ownerID = player.id;
        this.createdAt = Date.now();
        this.angle = angle;
        this.baseSpeed = player.weapon.bulletSpeed;
        this.velocity = {
            x: Math.floor(Math.cos(Util.toRadians(this.angle)) * this.baseSpeed) + player.spdX,
            y: Math.floor(Math.sin(Util.toRadians(this.angle)) * this.baseSpeed) + player.spdY
        };
        this.x = player.weapon.x;
        this.y = player.weapon.y;
        this.oX = this.x;
        this.oY = this.y;
        Bullet.bullets.set(this.id, this);
    }

    tick() {
        
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