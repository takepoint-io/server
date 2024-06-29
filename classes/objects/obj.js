const Util = require('../util');
const { worldValues } = require('../../data/values.json');

class Obj {
    static objectIDs = new Array(worldValues.maxEntities.objects).fill(null).map((e, i) => i + 1);
    static objects = new Map();
    constructor(type, x, y, radius, maxHealth = 0, teamCode = 3, timeToLive) {
        this.id = Obj.getObjectID();
        this.type = 1;
        this.objectType = type;
        this.createdAt = Date.now();
        this.timeToLive = timeToLive || 0;
        if (Util.hypot(x, y) > 4250) {
            this.x = 0;
            this.y = 0
        } else {
            this.x = x;
            this.y = y;
        }
        this.radius = radius;
        this.maxHealth = maxHealth;
        this.health = this.maxHealth;
        this.teamCode = teamCode;
        this.angle = 0;
        this.updatedThisTick = false;
        Obj.objects.set(this.id, this);
    }

    tick() {
        if (this.timeToLive <= 0) this.shouldDespawn = true;
        if (this.shouldDespawn) this.despawn();
        this.timeToLive--;
    }

    takeDamage(amount) {
        this.health = Util.clamp(this.health - amount, 0, this.maxHealth);
        if (this.health == 0) this.despawn();
        this.updatedThisTick = true;
    }

    despawn() {
        Obj.objects.delete(this.id);
        Obj.returnObjectID(this.id);
    }

    static getObjectID() {
        if (Obj.objectIDs.length > 0) {
            return Obj.objectIDs.shift();
        } else {
            let oldest = Infinity;
            for (let [_id, obj] of Obj.objects) {
                if (obj.createdAt < oldest) oldest = obj.createdAt;
            }
            return oldest.id;
        }
    }

    static returnObjectID(id) {
        Obj.objectIDs.push(id);
    }

    static init() {
        Obj.objectIDs = new Array(worldValues.maxEntities.objects).fill(null).map((e, i) => i + 1);
        Obj.objects = new Map();
    }
}

module.exports = Obj;