const Obj = require('./obj');
const Util = require('../util');
const { worldValues: { perks: { barrier } } } = require('../../data/values.json');

class Barrier extends Obj {
    static cooldown = barrier.cooldown * 25;
    static radius = barrier.radius;
    constructor(x, y) {
        super(1, x, y, barrier.radius, barrier.maxHealth, 0, barrier.lifespan * 25);
    }
    
    tick() {
        super.tick();
    }
};

module.exports = Barrier;