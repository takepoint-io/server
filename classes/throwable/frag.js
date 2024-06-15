const Throwable = require('./throwable');
const { worldValues: { perks: { frag } } } = require('../../data/values.json');

class Frag extends Throwable {
    static cooldown = frag.cooldown * 25;
    static dmg = frag.damage;
    static dmgDrop = frag.damageDrop;
    static pieces = frag.pieces;
    static radius = frag.explosionRadius;
    constructor(x, y, angle, player) {
        super(1, x, y, player.teamCode, angle, frag.travelSpeed, frag.travelTicks, frag.lifespan * 25, player);
    }

    tick() {
        super.tick();
        if (this.detonated) {
            this.radius = Frag.radius;
            this.shouldDespawn = true;
        }
    }
}

module.exports = Frag;