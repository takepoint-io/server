const Throwable = require('./throwable');
const Util = require('../util');
const { worldValues: { perks: { gas } } } = require('../../data/values.json');

class Gas extends Throwable {
    static cooldown = gas.cooldown * 25;
    static dmg = gas.damage;
    constructor(x, y, angle, player) {
        super(0, x, y, player.teamCode, angle, gas.travelSpeed, gas.travelTicks, gas.lifespan * 25, player);
    }

    tick() {
        super.tick();
        if (this.detonating) {
            if (!this.detonated) this.detonated = 1;
            this.radius = Util.clamp(this.radius + gas.expansionSpeed, 0, gas.maxRadius);
            if (this.radius == gas.maxRadius) this.radius = gas.maxRadius + this.teamCode;
        }
    }
}

module.exports = Gas;