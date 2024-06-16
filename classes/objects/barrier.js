const Obj = require('./obj');
const Util = require('../util');
const { worldValues: { perks: { barrier } } } = require('../../data/values.json');

class Barrier extends Obj {
    static cooldown = barrier.cooldown * 25;
    constructor(x, y) {
        super(1, x, y, barrier.radius, barrier.maxHealth, 0, barrier.lifespan * 25);
    }

    takeDamage(amount) {
        this.health = Util.clamp(this.health - amount, 0, this.maxHealth);
        if (this.health == 0) this.despawn();
        this.updatedThisTick = true;
    }

    tick() {
        super.tick();
    }
};

module.exports = Barrier;