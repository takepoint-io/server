const Obj = require('./obj');
const { worldValues: { perks: { barrier } } } = require('../../data/values.json');

class Barrier extends Obj {
    static cooldown = barrier.cooldown;
    constructor(x, y, teamCode) {
        super(1, x, y, barrier.radius, barrier.maxHealth, teamCode, barrier.lifespan * 25);
    }

    tick() {
        super.tick();
    }
};

module.exports = Barrier;