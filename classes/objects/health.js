const Obj = require('./obj');
const { worldValues: { perks: { health } } } = require('../../data/values.json');

class Health extends Obj {
    static cooldown = health.cooldown;
    constructor(x, y, teamCode) {
        super(0, x, y, health.radius, 0, teamCode, health.lifespan * 25);
        this.healingAmount = health.healingAmount;
    }

    tick() {
        super.tick();
    }
};

module.exports = Health;