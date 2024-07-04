const Util = require('../util');
const { worldValues } = require('../../data/values.json');

class Throwable {
    constructor(type, x, y, teamCode = 3, angle, travelSpeed, detonateAt, timeToLive, player) {
        this.id = Throwable.getThrowableID();
        this.type = 3;
        this.throwableType = type;
        this.createdAt = Date.now();
        this.player = player;
        this.travelTime = 0;
        this.detonateAt = detonateAt;
        this.timeToLive = timeToLive;
        if (Util.hypot(x, y) > 4250) {
            this.x = 0;
            this.y = 0
        } else {
            this.x = x;
            this.y = y;
        }
        this.velocity = {
            x: Math.floor(Math.cos(Util.toRadians(angle)) * travelSpeed + player.spdX / 2) || 0,
            y: Math.floor(Math.sin(Util.toRadians(angle)) * travelSpeed + player.spdY / 2) || 0
        };
        this.radius = 0;
        this.teamCode = teamCode;
        this.detonating = 0;
        this.angle = angle;
        Throwable.throwables.set(this.id, this);
    }

    get rX() {
        return Math.round(this.x);
    }

    get rY() {
        return Math.round(this.y);
    }

    tick() {
        if (this.timeToLive <= 0) this.shouldDespawn = true;
        if (this.shouldDespawn) this.despawn();
        if (this.travelTime < this.detonateAt) {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            this.angle = (this.angle + Math.floor((1 - this.travelTime / this.detonateAt) * Util.hypot(this.velocity.x, this.velocity.y))) % 360;
            this.travelTime++;
        }
        else this.detonating = 1;
        this.timeToLive--;
    }

    despawn() {
        Throwable.throwables.delete(this.id);
        Throwable.returnThrowableID(this.id);
    }

    static getThrowableID() {
        if (Throwable.throwableIDs.length > 0) {
            return Throwable.throwableIDs.shift();
        } else {
            let oldest = Infinity;
            for (let [_id, Throwable] of Throwable.throwables) {
                if (Throwable.createdAt < oldest) oldest = Throwable.createdAt;
            }
            return oldest.id;
        }
    }

    static returnThrowableID(id) {
        Throwable.throwableIDs.push(id);
    }

    static init() {
        Throwable.throwableIDs = new Array(worldValues.maxEntities.throwables).fill(null).map((e, i) => i + 1);
        Throwable.throwables = new Map();
    }
}

module.exports = Throwable;