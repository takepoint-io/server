const Throwable = require('./throwable');
const Bullet = require('../bullet');
const Util = require('../util');
const { worldValues: { perks: { frag } } } = require('../../data/values.json');

class Frag extends Throwable {
    static cooldown = frag.cooldown * 25;
    static dmg = frag.damage;
    static dmgDrop = frag.damageDrop;
    static radius = frag.explosionRadius;
    static shrapnelPieces = frag.shrapnel.pieces;
    static shrapnelSpeed = frag.shrapnel.speed;
    static shrapnelDmg = frag.shrapnel.damage;
    static shrapnelDmgDrop = frag.shrapnel.damageDrop;
    static shrapnelMinRange = frag.shrapnel.minRange;
    static shrapnelMaxRange = frag.shrapnel.maxRange;
    constructor(x, y, angle, player, world) {
        super(1, x, y, player.teamCode, angle, frag.travelSpeed, frag.travelTicks, frag.lifespan * 25, player);
        this.world = world;
    }

    tick() {
        super.tick();
        if (this.detonating && !this.detonated) {
            if (this.timeToLive == 0) {
                this.radius = Frag.radius;
                this.world.createExplosion(this.x, this.y, this.radius, this.player);
                for (let i = 0; i < Frag.shrapnelPieces; i++) {
                    new Bullet(this.player, Util.randRange(0, 360), {
                        weapon: {
                            bulletSpeed: Frag.shrapnelSpeed,
                            bulletSize: 1,
                            id: 3,
                            range: Util.randRange(Frag.shrapnelMinRange, Frag.shrapnelMaxRange),
                            damage: Frag.shrapnelDmg,
                            damageDropDistance: Frag.shrapnelDmgDrop,
                            x: this.x,
                            y: this.y,
                            isPerk: true
                        }
                    });
                }
                this.detonated = 1;
            }
        }
    }
}

module.exports = Frag;