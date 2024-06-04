const { weapons } = require('../data/enums.json');

class Weapon {
    constructor(name, player) {
        this.name = name.toLowerCase();
        this.id = weapons[this.name];
        this.player = player;
        this.maxAmmo = Weapon.maxAmmo(this.id, this.player);
        this.ammo = this.maxAmmo;
        this.firing = 0;
        this.reloading = 0;
        this.ticksBeforeReload = Weapon.ticksBeforeReload(this.player);
        this.ticksBeforeFire = Weapon.ticksBeforeFire(this.id);
        this.ticksSinceReload = this.ticksBeforeReload;
        this.ticksSinceFire = this.ticksBeforeFire;
    }

    attemptFire() {
        if (this.ticksSinceFire >= this.ticksBeforeFire && this.ammo > 0 && !this.reloading) {
            //let bullet = new Bullet();
            this.ammo--;
            this.firing = 1;
            this.ticksSinceFire = 0;
            return true; //return bullet;
        }
        else return false;
    }

    startReload() {
        this.reloading = 1;
        this.ticksSinceReload = 0;
    }

    finishReload() {
        this.reloading = 0;
        this.ammo = this.maxAmmo;
    }

    postTick() {
        this.ticksSinceReload++;
        this.ticksSinceFire++;
        this.firing = 0;
    }

    updateMaxAmmo() {
        this.maxAmmo = Weapon.maxAmmo(this.id, this.player);
    }

    updateTicksBeforeReload() {
        this.ticksBeforeReload = Weapon.ticksBeforeReload(this.player);
    }

    static maxAmmo(id, player) {
        let magazineLevel = player.upgrades.mags;
        switch (id) {
            case weapons.pistol:
                return 8 + magazineLevel * 4;
            case weapons.assault:
                return 16 + magazineLevel * 4;
            case weapons.sniper:
                return 5 + magazineLevel * 2;
            case weapons.shotgun:
                return 8 + magazineLevel * 2;
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