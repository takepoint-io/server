const { weapons } = require('../data/enums.json');

class Weapon {
    constructor(name, player) {
        this.name = name.toLowerCase();
        this.id = weapons[this.name];
        this.player = player;
        this.maxAmmo = Weapon.maxAmmo(this.id, this.player);
        this.ammo = this.maxAmmo;
        this.reloadingCooldown = 0;
        this.ticksSinceFire = 0;
        this.ticksBeforeReload = Weapon.ticksBeforeReload(this.player);
        this.ticksBeforeFire = Weapon.ticksBeforeFire(this.id);
    }

    static maxAmmo(id, player) {
        switch (id) {
            case weapons.pistol:
                return 8 + player.level * 4;
            case weapons.assault:
                return 16 + player.level * 4;
            case weapons.sniper:
                return 5 + player.level * 2;
            case weapons.shotgun:
                return 8 + player.level * 2;
        }
    }

    static ticksBeforeReload(player) {
        return 50 - player.upgrades.reload * 5
    } 

    static ticksBeforeFire(id) {
        switch (id) {
            case weapons.pistol:
                return 10;
            case weapons.assault:
                return 5;
            case weapons.sniper:
                return 25;
            case weapons.shotgun:
                return 10;
        }
    }
}

module.exports = Weapon;