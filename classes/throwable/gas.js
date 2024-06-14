const Throwable = require('./throwable');
const Util = require('../util');
const { worldValues: { perks: { gas } } } = require('../../data/values.json');

class Gas extends Throwable {
    static cooldown = gas.cooldown * 25;
    static dmg = gas.damage;
    constructor(x, y, angle, player) {
        super(0, x, y, 0, angle, gas.travelSpeed, gas.travelTicks, gas.lifespan * 25, player);
    }

    tick() {
        super.tick();
        if (this.detonated) {
            this.radius = Util.clamp(this.radius + gas.expansionSpeed, 0, gas.maxRadius);
        }
    }
}

module.exports = Gas;