const Throwable = require('./throwable');
const Packet = require('../packet');
const { worldValues: { perks: { selfDestruct } } } = require('../../data/values.json');

class SelfDestruct extends Throwable {
    static explosionRadius = selfDestruct.explosionRadius;
    static cosmeticRadii = selfDestruct.cosmeticRadii;
    static lowestHealth = selfDestruct.lowestHealth;
    static dmg = selfDestruct.damage;
    static dmgDrop = selfDestruct.damageDrop;
    constructor(player, world) {
        super(2, player.x, player.y, player.teamCode, 0, 0, selfDestruct.lifespan * 25, selfDestruct.lifespan * 25 + selfDestruct.cosmeticRadii.length, player);
        this.world = world;
        this.warningRadius = 0;
        this.warningValue = 0;
        this.player.packet.serverMessage(Packet.createServerMessage("selfDestruct", selfDestruct.lifespan));
        this.player.destructing = true;
    }

    tick() {
        super.tick();
        this.x = this.player.x + this.player.spdX;
        this.y = this.player.y + this.player.spdY;
        if (this.detonating && !this.detonated) {
            this.world.createExplosion(this.x, this.y, SelfDestruct.explosionRadius, this.player, SelfDestruct.dmg, SelfDestruct.dmgDrop, SelfDestruct.lowestHealth);
            this.player.takeDamage(Infinity, undefined, false, 0);
            this.world.onPlayerDeath(this.player, this.player);
            this.player.packet.serverMessage(Packet.createServerMessage("selfDestruct", 0));
            this.radius = SelfDestruct.cosmeticRadii[0];
            this.warningRadius = 0;
            this.detonated = 1;
        } else if (this.detonated) {
            for (let radius of SelfDestruct.cosmeticRadii) {
                if (radius > this.radius) {
                    this.radius = radius;
                    break;
                }
            }
        } else {
            this.warningRadius = (this.warningValue * 4) % 100;
            this.warningValue++;
        }
    }
}

module.exports = SelfDestruct;

