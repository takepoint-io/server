const { weapons } = require('../data/enums.json');
const Util = require('./util');
const Bullet = require('./bullet');

class Weapon {
    constructor(name, player) {
        this.name = name.toLowerCase();
        this.id = weapons[this.name];
        this.player = player;
        this.attachment = Weapon.createAttachment("", 0);
        this.positionConstants = Weapon.positionConstants(this.id);
        this.bulletSpeed = Weapon.bulletSpeed(this.id);
        this.bulletSize = Weapon.bulletSize(this.id);
        this.damage = Weapon.bulletDamage(this.id);
        this.damageDropDistance = Weapon.bulletDamageDrop(this.id);
        this.range = Weapon.range(this.id);
        this.maxAmmo = Weapon.maxAmmo(this.id, this.player);
        this.ammo = this.maxAmmo;
        this.spread = Weapon.spread(this.id);
        this.explosiveBullets = false;
        this.droneBullets = false;
        this.firing = 0;
        this.reloading = 0;
        this.ticksBeforeReload = Weapon.ticksBeforeReload(this.player);
        this.ticksBeforeFire = Weapon.ticksBeforeFire(this.id);
        this.ticksSinceReload = this.ticksBeforeReload;
        this.ticksSinceFire = this.ticksBeforeFire;
    }

    get x() {
        return this.player.x + Math.round(Math.cos(Util.toRadians(this.player.angle + this.positionConstants[0])) * this.positionConstants[1]);
    }

    get y() {
        return this.player.y + Math.round(Math.sin(Util.toRadians(this.player.angle + this.positionConstants[0])) * this.positionConstants[1]);
    }

    attemptFire() {
        if (this.ticksSinceFire >= this.ticksBeforeFire && this.ammo > 0 && !this.reloading) {
            let bullets = [];
            if (this.id == weapons.shotgun && this.attachment.name != "droneLauncher") {
                for (let i = 0; i < 6; i++) { 
                    bullets.push(new Bullet(this.player, this.player.angle + Util.randRange(-this.spread, this.spread))); 
                }
            }
            else {
                bullets.push(new Bullet(this.player, this.player.angle));
            }
            this.ammo--;
            this.firing = 1;
            this.ticksSinceFire = 0;
            return bullets;
        }
        else return false;
    }

    startReload() {
        this.reloading = 1;
        if (this.firing) {
            this.firing = 0;
            this.player.miscUpdates.set("firing", this.firing);
        }
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
        this.attachment.postTick();
    }

    updateMaxAmmo() {
        this.maxAmmo = Weapon.maxAmmo(this.id, this.player);
    }

    updateTicksBeforeReload() {
        this.ticksBeforeReload = Weapon.ticksBeforeReload(this.player);
    }

    setAttachment(id) {
        //so, instead of modularizing each weapon, I have decided to double down
        //on the strange decision of hardcoding weapons into the Weapon class.
        switch (this.id) {
            case weapons.assault:
                if (id == 1) {
                    this.attachment = Weapon.createAttachment("fireRate", 1);
                    this.ticksBeforeFire = 3;
                } else if (id == 2) {
                    this.attachment = Weapon.createAttachment("unlimitedAmmo", 2, () => {
                        if (this.ammo == 0) {
                            this.ammo = this.maxAmmo;
                            this.player.formUpdates.set("ammo", this.ammo);
                        }
                    });
                } else {
                    return false;
                }
                break;
            case weapons.sniper:
                if (id == 1) {
                    this.attachment = Weapon.createAttachment("highImpact", 1);
                    this.damageDropDistance *= 2;
                } else if (id == 2) {
                    this.attachment = Weapon.createAttachment("explosiveRounds", 2);
                    this.explosiveBullets = true;
                    this.damage = 0;
                    this.ticksBeforeFire = 30;
                } else {
                    return false;
                }
                break;
            case weapons.shotgun:
                if (id == 1) {
                    this.attachment = Weapon.createAttachment("longBarrel", 1);
                    this.positionConstants = [11, 110];
                    this.spread = 5;
                    this.bulletSpeed = 34;
                } else if (id == 2) {
                    this.attachment = Weapon.createAttachment("droneLauncher", 2);
                    this.spread = 2;
                    this.range = 100;
                    this.bulletSpeed = 20;
                    this.ticksBeforeFire = 4;
                    this.damage = 10;
                    this.damageDropDistance = 100;
                    this.droneBullets = true;
                } else {
                    return false;
                }
                break;
        }
        return true;
    }

    static createAttachment(name, id, postTickCallback=()=>{}) {
        return { name, id, postTick: postTickCallback };
    }

    static spread(id) {
        switch (id) {
            case weapons.shotgun:
                return 7;
        }
        return 0;
    }

    static positionConstants(id) {
        switch (id) {
            case weapons.pistol:
                return [16, 65];
            case weapons.assault:
                return [11, 110];
            case weapons.sniper:
                return [8, 135];
            case weapons.shotgun:
                return [13, 90];
        }
    }

    static bulletSpeed(id) {
        switch (id) {
            case weapons.pistol:
                return 30;
            case weapons.assault:
                return 34;
            case weapons.sniper:
                return 42;
            case weapons.shotgun:
                return 29;
        }
    }

    static bulletSize(id) {
        switch (id) {
            case weapons.pistol:
                return 2;
            case weapons.assault:
                return 2;
            case weapons.sniper:
                return 3;
            case weapons.shotgun:
                return 1;
        }
    }

    static bulletDamage(id) {
        switch (id) {
            case weapons.pistol:
                return 24;
            case weapons.assault:
                return 18;
            case weapons.sniper:
                return 65;
            case weapons.shotgun:
                return 18;
        }
    }

    static bulletDamageDrop(id) {
        switch (id) {
            case weapons.pistol:
                return 36;
            case weapons.assault:
                return 46;
            case weapons.sniper:
                return 26;
            case weapons.shotgun:
                return 24;
        }
    }

    static range(id) {
        switch (id) {
            case weapons.pistol:
                return 22;
            case weapons.assault:
                return 20;
            case weapons.sniper:
                return 24;
            case weapons.shotgun:
                return 10;
        }
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
        return 45 - player.upgrades.reload * 5
    }

    static ticksBeforeFire(id) {
        switch (id) {
            case weapons.pistol:
                return 10;
            case weapons.assault:
                return 4;
            case weapons.sniper:
                return 20;
            case weapons.shotgun:
                return 10;
        }
    }
}

module.exports = Weapon;