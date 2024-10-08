require('dotenv').config();
const { QuadTree, Box, Circle } = require('js-quadtree');
const axios = require('axios');
const { isEmail } = require('validator');
const Packet = require('./packet');
const Point = require('./point');
const Bullet = require('./bullet');
const Obj = require('./objects/obj');
const Throwable = require('./throwable/throwable');
const Team = require('./team');
const PerkList = [
    'objects/barrier',
    'objects/health',
    'throwable/gas',
    'throwable/frag',
    'throwable/selfDestruct',
    'objects/turret'
].map(e => require('./' + e));
const Perks = { 
    Barrier: PerkList[0],
    Health: PerkList[1],
    Gas: PerkList[2],
    Frag: PerkList[3],
    SelfDestruct: PerkList[4],
    Turret: PerkList[5]
};
const Util = require('./util');
const { commands, commandsArr } = require('./adminCmds');
const { worldValues } = require('../data/values.json');

class World {
    inputTypes = ["left", "right", "up", "down", "reload", "space", "mouse"];
    constructor(players, config, postRequest) {
        this.config = config;
        this.postRequest = postRequest;
        this.players = players;
        this.initWorld();
    }

    initWorld() {
        this.radius = worldValues.radius;
        this.points = worldValues.points.coords.map((coords, i) => new Point(coords, i));
        this.pointStatus = [0, 0, 0];
        this.teams = [
            new Team("red", 0), new Team("green", 1), new Team("blue", 2)
        ];
        this.leaderboard = [];
        this.guestNames = worldValues.guestNames.map(name => this.initGuestName(name));
        this.tickCount = 0;
        this.tree = new QuadTree(new Box(-4250, -4250, 8500, 8500), {
            maximumDepth: 5,
            arePointsEqual: (point1, point2) => point1.data.type == point2.data.type && point1.data.id == point2.data.id
        });
        Bullet.init();
        Obj.init();
        Throwable.init();
    }

    evalTick() {
        this.preTick();
        this.tick();
        this.postTick();
        this.sendUpdates();
        this.tickCount++;
    }

    preTick() {
        for (let [_playerID, player] of this.players) {
            for (let event of player.registeredEvents) {
                switch (event) {
                    case "spawned":
                        player.respawn(this);
                        if (this.config.cheats) player.addScore(20000);
                        player.packet.spawn(player);
                        for (let point of this.points) {
                            player.packet.pointInfo(point);
                        }
                        player.packet.teamCtrl(this.pointStatus);
                        player.packet.leaderboard(this.leaderboard);
                        break;
                    case "connected":
                        for (let point of this.points) {
                            player.packet.pointInfo(point);
                        }
                        player.packet.viewbox(player);
                        for (let [_playerID, player] of this.players) {
                            player.packet.playersOnline(this.players.size);
                        }
                        player.packet.requestCaptcha();
                        break;
                }
            }
            for (let key of player.keyDowns) {
                player.inputs[key[0]] = true;
            }
        }
    }

    tick() {
        this.updateBullets();
        this.updateWeapons();
        this.runCollisions();
        for (let [_playerID, player] of this.players) {
            this.updatePlayerPosition(player);
            if (player.inGame) this.updatePlayerVelocity(player);
            if (player.spawned) this.updatePlayerHealth(player);
        }
        this.updatePoints();
        this.updatePerks();
        this.updateQuadtree();
        //update each player's viewbox
        for (let [_playerID, player] of this.players) {
            this.updateView(player);
        }
        this.updateMinimap();
        //updates that should only happen every "x" number of ticks
        if (this.tickCount % 125 == 0) {
            //point bonus for # of points capped
            for (let [_playerID, player] of this.players) {
                if (!player.inGame || player.spawnProt) continue;
                let pointBonus = this.pointStatus[player.teamCode];
                if (pointBonus > 0) player.addScore(pointBonus);
            }
        }
        if (this.tickCount % 5 == 0) {
            this.updateLeaderboard();
        }
    }

    postTick() {
        for (let [_playerID, player] of this.players) {
            if (player.registeredEvents.includes("disconnected")) {
                this.players.delete(player.id);
                this.guestNames.find(n => n.name == player.guestName).used = false;
                for (let [_playerID, player] of this.players) {
                    player.packet.playersOnline(this.players.size);
                }
                this.handleLogout(player, true);
                continue;
            }
            else if (player.registeredEvents.includes("despawned")) {
                player.spawnTimeout = 3 * 25;
                player.informedOfRespawn = false;
                player.packet.playerExit(player.id);
                player.packet.stats(player);
            }
            player.packet.playerUpdate(player);
            if (player.miscUpdates.size > 0) {
                player.packet.playerMiscData(player);
            }
            player.weapon.postTick();
            if (player.formUpdates.size > 0) {
                player.packet.upgrades(player);
            }
            player.registeredEvents = [];
            player.collisions = [];
            player.collidingWithObject = false;
            player.miscUpdates.clear();
            player.formUpdates.clear();
            for (let keyUp of player.keyUps) {
                //let lastDownPress = player.keyDowns.find(keyDown => keyDown[1] > keyUp[1]);
                player.inputs[keyUp[0]] = false;
            }
            player.keyDowns = [];
            player.keyUps = [];
            if (player.chainTimer > 0) {
                player.chainTimer--;
                if (player.chainTimer == 0) player.chainLevel = 0;
            }
            if (player.spawnTimeout > 0) player.spawnTimeout--;
            if (player.spawnTimeout == 0 && !player.informedOfRespawn) {
                player.packet.respawnButtonAvailable();
                player.informedOfRespawn = true;
            }
        }
        for (let [_objectID, object] of Obj.objects) {
            object.updatedThisTick = false;
        }
        for (let point of this.points) {
            point.postTick();
        }
        this.updateQuadtree();
    }

    updateQuadtree() {
        this.tree.clear();
        for (let [_playerID, player] of this.players) {
            if (!player.spawned) continue;
            this.addCircleToTree(player);
        }
        for (let [_objectID, object] of Obj.objects) {
            this.addCircleToTree(object);
        }
        for (let [_bulletID, bullet] of Bullet.bullets) {
            this.addEntityToTree(bullet);
        }
        for (let [_throwableID, throwable] of Throwable.throwables) {
            this.addEntityToTree(throwable);
        }
    }

    queryPlayers(x, y, radius) {
        return this.tree.query(new Circle(x, y, radius)).filter(e => e.data.type == 0);
    }

    queryObjects(query) {
        return this.tree.query(query).filter(e => e.data.type == 1);
    }

    queryPlayerView(player) {
        let vx = player.viewbox.x * 1.1;
        let vy = player.viewbox.y * 1.1;
        return this.tree.query(
            new Box(
                player.x - vx / 2, 
                player.y - vy / 2,
                vx,
                vy
            )
        );
    }

    addCircleToTree(obj) {
        this.tree.insert(new Circle(obj.x, obj.y, obj.radius, { id: obj.id, type: obj.type }));
    }

    addEntityToTree(obj) {
        this.tree.insert(new Box(obj.x, obj.y, 0, 0, { id: obj.id, type: obj.type }));
    }

    removeFromTree(obj) {
        this.tree.remove(new Circle(0, 0, 0, { id: obj.id, type: obj.type }));
    }

    sendUpdates() {
        for (let [_playerID, player] of this.players) {
            if (player.packet.data.packetList.length == 0) continue;
            player.sendUpdate(player.packet.enc());
            player.packet = new Packet();
            player.socket.packetsThisTick = 0;
        }
    }

    updateLeaderboard() {
        let playerArray = Array.from(this.players, ([n,v]) => v).filter(p => p.spawned);
        this.leaderboard = playerArray.sort((a, b) => b.stats.score - a.stats.score).slice(0, 10);
        for (let [_playerID, player] of this.players) {
            player.packet.leaderboard(this.leaderboard);
        }
    }

    updatePoints() {
        for (let point of this.points) {
            let res = this.queryPlayers(point.x, point.y, point.radius + 100)
                .map(p => this.players.get(p.data.id))
                .filter(p => p.spawned && !p.spawnProt && Util.hypot(p.x - point.x, p.y - point.y) < point.radius + p.radius * 1.8);
            if (res.length) {
                let statusChanged = point.update(res);
                if (statusChanged) {
                    //award the points
                    if (point.neutralizedThisTick) {
                        for (let player of res) {
                            player.addScore(worldValues.scoreAwards.pointNeutrailzed * point.scoreMultiplier);
                            player.stats.pointsNeutralized++;
                            player.packet.serverMessage(Packet.createServerMessage("pointNeutralized"));
                        }
                    } else if (point.capturedThisTick) {
                        this.pointStatus = [
                            Point.percentByTeam(0, this.points),
                            Point.percentByTeam(1, this.points),
                            Point.percentByTeam(2, this.points)
                        ];
                        for (let player of res) {
                            player.addScore(worldValues.scoreAwards.pointTaken * point.scoreMultiplier);
                            player.stats.pointsTaken++;
                            player.packet.serverMessage(Packet.createServerMessage("pointTaken"));
                        }
                    }
                    for (let [_playerID, player] of this.players) {
                        player.packet.pointUpdate(point);
                        if (point.neutralizedThisTick) player.packet.pointInfo(point);
                        if (point.capturedThisTick) player.packet.teamCtrl(this.pointStatus);
                    }
                }
            }
        }
    }

    updateMinimap() {
        for (let [_playerID, player] of this.players) {
            if (player.spawned) player.packet.minimap(player.team.players);
        }
    }

    runCollisions() {
        //player-to-player collisions
        for (let [_playerID, player] of this.players) {
            if (!player.inGame) continue;
            player.testPosition = {
                x: player.x + player.spdX,
                y: player.y + player.spdY
            };
            let nearbyEntities = this.tree.query(new Circle(player.x, player.y, 100));
            let nearbyPlayers = nearbyEntities.filter(e => e.data.type == 0 && e.data.id != player.id);
            for (let i = 0; i < nearbyPlayers.length; i++) {
                let checkingPlayer = this.players.get(nearbyPlayers[i].data.id);
                if (player.teamCode != checkingPlayer.teamCode && checkingPlayer.inGame && !player.collisions.includes(checkingPlayer.id)) {
                    let distance = Math.sqrt((checkingPlayer.x - player.testPosition.x) ** 2 + (checkingPlayer.y - player.testPosition.y) ** 2);
                    if (distance < player.radius + checkingPlayer.radius) {
                        let checkingPlayerSpdX = checkingPlayer.spdX;
                        let checkingPlayerSpdY = checkingPlayer.spdY;
                        checkingPlayer.spdX = player.spdX;
                        checkingPlayer.spdY = player.spdY;
                        player.spdX = checkingPlayerSpdX;
                        player.spdY = checkingPlayerSpdY;
                        player.collisions.push(checkingPlayer.id);
                        checkingPlayer.collisions.push(player.id);
                        break;
                    }
                }
            }
        }
        //player-object collisions
        for (let [_objectID, object] of Obj.objects) {
            let nearbyEntities = this.tree.query(new Circle(object.x, object.y, 100));
            let nearbyPlayers = nearbyEntities.filter(e => e.data.type == 0);
            for (let i = 0; i < nearbyPlayers.length; i++) {
                let checkingPlayer = this.players.get(nearbyPlayers[i].data.id);
                if (checkingPlayer && checkingPlayer.inGame) {
                    let distX = checkingPlayer.x - object.x;
                    let distY = checkingPlayer.y - object.y;
                    let distance = Util.hypot(distX, distY);
                    if (distance < object.radius + checkingPlayer.radius) {
                        if (object.objectType == 0) {
                            if (checkingPlayer.health < checkingPlayer.maxHealth) {
                                checkingPlayer.health = Util.clamp(checkingPlayer.health + object.healingAmount, 0, checkingPlayer.maxHealth);
                                checkingPlayer.miscUpdates.set("hp", checkingPlayer.health);
                                object.despawn();
                            }
                        }
                        else if ((object.objectType == 1 || object.objectType == 2) && !checkingPlayer.collidingWithObject) {
                            let angleToObject = Util.toRadians(Util.angle(distX, distY));
                            checkingPlayer.x += Math.cos(angleToObject)
                            checkingPlayer.y += Math.sin(angleToObject);
                            checkingPlayer.spdX = 0;
                            checkingPlayer.spdY = 0;
                            checkingPlayer.collidingWithObject = true;
                        }
                    }
                }
            }
        }
        //bullet-entity collisions
        for (let [_bulletID, bullet] of Bullet.bullets) {
            let nearbyEntities = this.tree.query(new Circle(bullet.x, bullet.y, 50));
            let thingsToHit = nearbyEntities.filter(e => e.data.type == 0 || e.data.type == 1);
            let hits = [];
            for (let i = 0; i < thingsToHit.length; i++) {
                let entityType = thingsToHit[i].data.type;
                let entityID = thingsToHit[i].data.id;
                let entity;
                if (entityType == 0) {
                    let player = this.players.get(entityID);
                    if (!player.inGame || player.spawnProt) continue;
                    player.testPosition = {
                        x: player.x + player.spdX,
                        y: player.y + player.spdY
                    };
                    entity = player;
                } else if (entityType == 1) {
                    let object = Obj.objects.get(entityID);
                    if (!object || (object.objectType != 1 && object.objectType != 2)) continue;
                    if (object.objectType == 2 && bullet.teamCode == object.teamCode) continue;
                    object.testPosition = {
                        x: object.x,
                        y: object.y
                    };
                    entity = object;
                }
                if (entityType != 0 || entity.teamCode != bullet.teamCode) {
                    let segment = {
                        p1: { x: bullet.x, y: bullet.y },
                        p2: { x: bullet.x + bullet.velocity.x, y: bullet.y + bullet.velocity.y }
                    };
                    let hit = Util.circleLineSegmentIntersect(entity.testPosition, segment, entity.radius + bullet.size);
                    if (hit) hits.push({ entity: entity, pos: hit });
                }
            }
            if (hits.length == 0) continue;
            if (!bullet.parentWeapon.isPerk) {
                bullet.player.stats.weapons[bullet.player.weapon.id].bulletsHit++;
                bullet.player.stats.weapons[bullet.player.weapon.id].damageDealt += bullet.dmg;
            }
            bullet.player.stats.bulletsHit++;
            bullet.player.stats.damageDealt += bullet.dmg;
            bullet.despawn();
            let closest = { entity: null, dist: Infinity, pos: null };
            for (let i = 0; i < hits.length; i++) {
                let dist = Util.distance(hits[i].entity.testPosition, bullet.spawnedAt);
                if (dist < closest.dist) {
                    closest = {
                        entity: hits[i].entity,
                        dist: dist,
                        pos: hits[i].pos
                    };
                }
            }
            switch (closest.entity.type) {
                case 0:
                    let player = closest.entity;
                    let res = player.takeDamage(bullet.dmg, bullet.player);
                    if (res) this.onPlayerDeath(player, bullet.player);
                    break;
                case 1:
                    let object = closest.entity;
                    object.takeDamage(bullet.dmg);
                    break;
            }
            //if the hitmarker is inside the circle then we use that otherwise we move it to the first endpoint
            let distance = Util.distance({ x: bullet.x + bullet.velocity.x, y: bullet.y + bullet.velocity.y }, closest.entity);
            if (distance < closest.entity.radius) bullet.player.packet.hitMarker({ x: bullet.x + bullet.velocity.x, y: bullet.y + bullet.velocity.y });
            else bullet.player.packet.hitMarker(closest.pos);
        }
        //throwable-player collisions
        for (let [_throwableID, throwable] of Throwable.throwables) {
            if (!throwable.detonated) continue;
            let nearbyEntities = this.tree.query(new Circle(throwable.x, throwable.y, throwable.radius + 100));
            let nearbyPlayers = nearbyEntities.filter(e => e.data.type == 0);
            for (let i = 0; i < nearbyPlayers.length; i++) {
                let checkingPlayer = this.players.get(nearbyPlayers[i].data.id);
                if (checkingPlayer && checkingPlayer.inGame && !checkingPlayer.spawnProt) {
                    let distance = Util.distance(throwable, checkingPlayer);
                    if (distance < throwable.radius + checkingPlayer.radius) {
                        switch (throwable.throwableType) {
                            case 0:
                                if (throwable.teamCode == checkingPlayer.teamCode) break;
                                checkingPlayer.accumulatedHealth -= Perks.Gas.dmg;
                                if (checkingPlayer.accumulatedHealth < 0) {
                                    let dmg = Math.abs(Math.ceil(checkingPlayer.accumulatedHealth));
                                    checkingPlayer.takeDamage(dmg, throwable.player, false);
                                    checkingPlayer.accumulatedHealth += dmg;
                                }
                                checkingPlayer.beingHit = 1;
                                checkingPlayer.miscUpdates.set("beingHit", checkingPlayer.beingHit);
                                if (checkingPlayer.health == 0) this.onPlayerDeath(checkingPlayer, throwable.player);
                                break;
                            case 1:
                                break;
                        }
                    }
                }
            }
        }
    }

    updateWeapons() {
        for (let [_playerID, player] of this.players) {
            if (!player.inGame) continue;
            let weapon = player.weapon;
            if (player.inputs.mouse) {
                let bullets = weapon.attemptFire();
                if (bullets) {
                    player.stats.bulletsFired += bullets.length;
                    player.stats.weapons[player.weapon.id].bulletsFired += bullets.length;
                    player.miscUpdates.set("firing", weapon.firing); 
                    player.formUpdates.set("ammo", weapon.ammo);
                }
            }
            if (weapon.ticksSinceFire == weapon.ticksBeforeFire - 1) {
                player.miscUpdates.set("firing", weapon.firing);
            }
            if (!weapon.reloading && ((player.inputs.reload && weapon.ammo < weapon.maxAmmo) || (weapon.ammo == 0 && weapon.ticksSinceFire >= weapon.ticksBeforeFire))) {
                weapon.startReload();
                player.miscUpdates.set("reloading", weapon.reloading);
            }
            if (weapon.reloading && weapon.ticksSinceReload >= weapon.ticksBeforeReload) {
                weapon.finishReload();
                player.miscUpdates.set("reloading", weapon.reloading);
                player.formUpdates.set("ammo", weapon.ammo);
            }
        }
    }

    updatePerks() {
        for (let [_playerID, player] of this.players) {
            if (!player.inGame || !player.perkUpgradeSelected) continue;
            if (player.inputs.space && player.currentCooldown == 0) {
                switch (player.perkID) {
                    case 1: {
                        let spawnPoint = Util.circlePoint(player.angle, player, player.radius + Perks.Barrier.radius + 10);
                        new Perks.Barrier(spawnPoint.x, spawnPoint.y);
                        player.maxCooldown = Perks.Barrier.cooldown;
                        break;
                    }
                    case 2: {
                        let spawnPoint = Util.circlePoint(player.angle, player, player.radius + Perks.Health.radius + 10);
                        new Perks.Health(spawnPoint.x, spawnPoint.y);
                        player.maxCooldown = Perks.Health.cooldown;
                        break;
                    }
                    case 3: {
                        new Perks.Gas(player.x, player.y, player.angle, player);
                        player.maxCooldown = Perks.Gas.cooldown;
                        break;
                    }
                    case 4: {
                        new Perks.Frag(player.x, player.y, player.angle, player, this);
                        player.maxCooldown = Perks.Frag.cooldown;
                        break;
                    }
                    case 5: {
                        new Perks.SelfDestruct(player, this);
                        player.maxCooldown = 100_000; //mhm
                        break;
                    }
                    case 6: {
                        let spawnPoint = Util.circlePoint(player.angle, player, player.radius + Perks.Turret.radius + 10);
                        new Perks.Turret(spawnPoint.x, spawnPoint.y, player, this);
                        player.maxCooldown = Perks.Turret.cooldown;
                        break;
                    }
                }
                player.currentCooldown = player.maxCooldown;
            }
            if (player.currentCooldown > 0) {
                player.currentCooldown--;
                player.formUpdates.set("perkCooldown", Math.round(player.currentCooldown / player.maxCooldown * 100));
            }
        }
        for (let [_objectID, object] of Obj.objects) {
            object.tick();
        }
        for (let [_throwableID, throwable] of Throwable.throwables) {
            throwable.tick();
        }
    }

    createExplosion(x, y, radius, creator, damage, damageDrop, minHp = 0) {
        let playersHit = this.queryPlayers(x, y, radius + 100)
            .map(p => this.players.get(p.data.id))
            .filter(p => p.inGame && !p.spawnProt && Util.distance(p, {x,y}) < radius + p.radius);
        for (let playerHit of playersHit) {
            if (playerHit.teamCode == creator.teamCode) continue;
            let dmg = damage - Math.floor(Util.distance(playerHit, {x,y}) / damageDrop);
            let res = playerHit.takeDamage(dmg, creator, undefined, minHp);
            if (res) this.onPlayerDeath(playerHit, creator);
        }
        let objectsHit = this.queryObjects(new Circle(x, y, radius + 100))
            .map(o => Obj.objects.get(o.data.id))
            .filter(o => o && (o.objectType == 1 || o.objectType == 2) && Util.distance(o, {x,y}) < radius + o.radius);
        for (let objectHit of objectsHit) {
            let dmg = damage - Math.floor(Util.distance(objectHit, {x,y}) / damageDrop);
            objectHit.takeDamage(dmg);
        }
    }

    updateBullets() {
        for (let [_bulletID, bullet] of Bullet.bullets) {
            bullet.tick();
        }
    }

    updateView(player) {
        let viewbox = this.queryPlayerView(player);
        let playersChecked = {};
        let objectsChecked = {};
        let bulletsChecked = {};
        let throwablesChecked = {};
        for (let i = 0; i < viewbox.length; i++) {
            let entity = viewbox[i];
            switch (entity.data.type) {
                case 0:
                    let playerTwo = this.players.get(entity.data.id);
                    if (player.id == playerTwo.id || !playerTwo.spawned) break;
                    if (!player.playerPool.has(playerTwo.id) || playerTwo.formUpdates.has("attachmentChosen")) {
                        player.playerPool.set(playerTwo.id, playerTwo);
                        player.packet.playerJoin(playerTwo);
                    }
                    if (playerTwo.miscUpdates.size > 0) {
                        player.packet.playerMiscData(playerTwo);
                    }
                    player.packet.playerUpdate(playerTwo);
                    playersChecked[playerTwo.id] = true;
                    break;

                case 1:
                    let object = Obj.objects.get(entity.data.id);
                    if (!player.objectPool.has(object.id)) {
                        player.objectPool.set(object.id, object);
                        player.packet.objectJoin(object);
                    }
                    if (object.updatedThisTick) {
                        player.packet.objectUpdate(object);
                    }
                    objectsChecked[object.id] = true;
                    break;

                case 2:
                    let bullet = Bullet.bullets.get(entity.data.id);
                    if (!player.bulletPool.has(bullet.id) || bullet.isDrone) {
                        if (bullet.isDrone) player.packet.bulletExit(bullet.id);
                        player.bulletPool.set(bullet.id, bullet);
                        player.packet.bulletJoin(bullet);
                    }
                    player.packet.bulletUpdate(bullet);
                    bulletsChecked[bullet.id] = true;
                    break;

                case 3:
                    let throwable = Throwable.throwables.get(entity.data.id);
                    if (!player.throwablePool.has(throwable.id)) {
                        player.throwablePool.set(throwable.id, throwable);
                        player.packet.throwableJoin(throwable);
                    }
                    player.packet.throwableUpdate(throwable);
                    throwablesChecked[throwable.id] = true;
                    break;

                default:
                    break;
            }
        }
        //check every entity that's now in our view and if we didn't get an update for it, remove it
        for (let [_playerID, p2] of player.playerPool) {
            if (!playersChecked[_playerID]) {
                player.packet.playerExit(_playerID);
                player.playerPool.delete(_playerID)
            }
        }
        for (let [_objectID, object] of player.objectPool) {
            if (!objectsChecked[_objectID]) {
                player.packet.objectExit(_objectID);
                player.objectPool.delete(_objectID);
            }
        }
        for (let [_bulletID, bullet] of player.bulletPool) {
            if (!bulletsChecked[_bulletID]) {
                player.packet.bulletExit(_bulletID);
                player.bulletPool.delete(_bulletID);
            }
        }
        for (let [_throwableID, throwable] of player.throwablePool) {
            if (!throwablesChecked[_throwableID]) {
                player.packet.throwableExit(_throwableID);
                player.throwablePool.delete(_throwableID);
            }
        }
    }

    updatePlayerPosition(player) {
        if (!player.spawned) {
            //This player is in the lobby, so we just update according to its angle to the center
            let scrollX = 0;
            let scrollY = 0;
            let speed = 2;
            if (player.loadingScreenDir > 0 && player.loadingScreenDir < 4)  scrollY = -1;
            if (player.loadingScreenDir > 4) scrollY = 1;
            if (player.loadingScreenDir == 0 || player.loadingScreenDir == 1 || player.loadingScreenDir == 7) scrollX = -1;
            if (player.loadingScreenDir > 2 && player.loadingScreenDir < 6 ) scrollX = 1;
            
            if (scrollX && scrollY) speed *= Math.SQRT1_2;
            player.spdX = scrollX * speed;
            player.spdY = scrollY * speed;

            if (Math.abs(player.x) > 4000 || Math.abs(player.y) > 4000) player.loadingScreenDir = Math.floor(Util.angle(player.x, player.y) / 45);
            player.x += player.rSpdX;
            player.y += player.rSpdY;
        }
        else {
            let tmpX = player.x;
            let tmpY = player.y;
            player.x += player.rSpdX;
            player.y += player.rSpdY;
            player.stats.distanceCovered += Util.hypot(player.rSpdX, player.rSpdY);
            let distToCenter = Util.hypot(player.x, player.y);
            if (distToCenter > 4250) {
                if (Util.hypot(tmpX, tmpY) > 4249) {
                    player.spdX = 0;
                    player.spdY = 0;
                    player.x = tmpX;
                    player.y = tmpY;
                }
                else {
                    player.spdX = 0;
                    player.spdY = 0;
                    player.x = Math.round(player.x * 4250 / distToCenter);
                    player.y = Math.round(player.y * 4250 / distToCenter);
                }
            }
        }
    }

    updatePlayerVelocity(player) {
        //Apply a resistive force if not moving in direction
        let coefficients = player.numInputs ? 
            { x: Math.abs(player.spdX) / player.maxSpeed, y: Math.abs(player.spdY) / player.maxSpeed } :
            { x: 0.5, y: 0.5};
        if (player.inputs.left == player.inputs.right) {
            let resistX = coefficients.x * Math.sign(player.spdX) * player.maxSpeed / 8;
            if (Math.abs(resistX) > Math.abs(player.spdX)) player.spdX = 0;
            else player.spdX -= resistX;
        }
        if (player.inputs.up == player.inputs.down) {
            let resistY = coefficients.y * Math.sign(player.spdY) * player.maxSpeed / 8;
            if (Math.abs(resistY) > Math.abs(player.spdY)) player.spdY = 0;
            else player.spdY -= resistY;
        }

        //Update velocity based on player input if not colliding
        if (!player.collidingWithObject) {
            if (player.inputs.left  && !player.inputs.right) player.spdX -= (player.maxSpeed + player.spdX) / 9;
            if (player.inputs.right && !player.inputs.left ) player.spdX += (player.maxSpeed - player.spdX) / 9;
            if (player.inputs.up    && !player.inputs.down ) player.spdY -= (player.maxSpeed + player.spdY) / 9;
            if (player.inputs.down  && !player.inputs.up   ) player.spdY += (player.maxSpeed - player.spdY) / 9;
        }

        /*if (player.numInputs > 1) {
            let maxSpeedDiagonal = player.maxSpeed * Math.SQRT1_2;
            if (Math.abs(player.spdX) > maxSpeedDiagonal) {
                let diff = player.spdX - maxSpeedDiagonal * Math.sign(player.spdX);
                player.spdX -= diff * 0.25;
            }
            if (Math.abs(player.spdY) > maxSpeedDiagonal) {
                let diff = player.spdY - maxSpeedDiagonal * Math.sign(player.spdY);
                player.spdY -= diff * 0.25;
            }
        }*/

        player.spdX = Util.clamp(player.spdX, -player.maxSpeed, player.maxSpeed);
        player.spdY = Util.clamp(player.spdY, -player.maxSpeed, player.maxSpeed);
        player.normalizeSpeed();
    }

    updatePlayerHealth(player) {
        if (!player.dying) {
            let healedThisTick = 0.04 + 0.02 * player.upgrades.heal;
            player.accumulatedHealth += healedThisTick;
            if (Math.abs(player.accumulatedHealth) < 1) return;
            player.health = Util.clamp(player.health + Math.floor(player.accumulatedHealth), 0, player.maxHealth);
            player.accumulatedHealth -= Math.floor(player.accumulatedHealth);
            player.miscUpdates.set("hp", player.health);
        }
        else {
            player.radius--;
            player.miscUpdates.set("deathFrame", 25 - player.radius);
            if (player.radius == 0) {
                player.dying = false;
                player.spawned = false;
                player.registeredEvents.push("despawned");
            }
        }
    }

    onPlayerDeath(player, killer) {
        player.inGame = false;
        player.dying = true;
        player.spdX = 0;
        player.spdY = 0;
        player.stats.stopGameTimer();
        if (killer) {
            killer.stats.kills++;
            killer.stats.weapons[killer.weapon.id].kills++;

            if (player.username != killer.username) {
                player.packet.serverMessage(Packet.createServerMessage("killed", killer.username));
                killer.packet.serverMessage(Packet.createServerMessage("kill", player.username));
                killer.chainLevel++;
                killer.chainTimer = 75;
                if (killer.chainLevel == 2) {
                    killer.packet.serverMessage(Packet.createServerMessage("doubleKill"));
                    killer.stats.doubleKills++;
                } else if (killer.chainLevel == 3) {
                    killer.packet.serverMessage(Packet.createServerMessage("tripleKill"));
                    killer.stats.tripleKills++;
                } else if (killer.chainLevel >= 4) {
                    killer.packet.serverMessage(Packet.createServerMessage("multiKill"));
                    killer.stats.multiKills++;
                }
            } else if (killer.perkID != 6) {
                killer.packet.serverMessage(Packet.createServerMessage("died"));
            }
        }

        if (!this.config.dev) {
            player.stats.upgrades = player.upgrades;
            player.stats.perkID = player.perkID;
            this.postRequest('/gameStats', {
                stats: JSON.stringify(player.stats),
                username: player.loggedIn ? player.username : "N/A"
            }).catch(e => {});
        }
    }

    getSpawnPoint(teamCode) {
        let spawnPointData = {
            x: 0,
            y: 0, 
            angle: Math.random() * Math.PI * 2
        };
        let ownedByTeam = Point.cappedByTeam(teamCode, this.points);
        if (ownedByTeam.length > 0) {
            //choose random coords inside closest point using rejection sampling
            let point = ownedByTeam[0];
            spawnPointData.radius = point.radius;
            while (true) {
                let x = (2 * point.radius * Math.random()) - point.radius;
                let y = (2 * point.radius * Math.random()) - point.radius;
                if (x ** 2 + y ** 2 < point.radius ** 2) {
                    spawnPointData.x = point.x + x;
                    spawnPointData.y = point.y + y;
                    break;
                }
            }
        }
        else {
            //choose point on edge if the team controls no points
            spawnPointData.radius = this.config.cheats ? 100 : this.radius - 100;
            spawnPointData.x = Math.cos(spawnPointData.angle) * spawnPointData.radius;
            spawnPointData.y = Math.sin(spawnPointData.angle) * spawnPointData.radius;
        }
        return [Math.floor(spawnPointData.x), Math.floor(spawnPointData.y)];
    }

    getTeam() {
        let sortedTeams = this.teams.sort((a, b) => a.players.size - b.players.size);
        let candidates = sortedTeams.filter(team => team.players.size == sortedTeams[0].players.size);
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    getPlayerByName(name) {
        if (!name) return;
        for (let [_playerID, player] of this.players) {
            if (player.username.split(" ").join("_").toLowerCase() == name.toLowerCase()) {
                return player;
            }
        }
    }

    initGuestName(name) {
        return {
            used: false,
            name: name
        };
    }

    allocateGuestName(player) {
        let available = this.guestNames.filter(name => !name.used);
        let nameObj = available[Math.floor(Math.random() * available.length)];
        nameObj.used = true;
        player.guestName = nameObj.name;
        player.username = "Guest " + player.guestName;
    }


    handleMessage(player, data) {
        switch (data.type) {
            case "reset":
                this.resetInputs(player);
                break;
            case "keypress":
                this.handleKeyInput(player, data.key, data.pressed);
                break;
            case "mouse":
                this.handleMouseInput(player, data.x, data.y, data.angle);
                break;
            case "spawn":
                this.handleSpawn(player);
                break;
            case "upgrade":
                this.handleUpgrade(player, data.value);
                break;
            case "gun":
                this.handleGunUpgrade(player, data.gun);
                break;
            case "perk":
                this.handlePerkUpgrade(player, data.perk);
                break;
            case "attachment":
                this.handleAttachmentUpgrade(player, data.attachment);
                break;
            case "chat":
                this.handleChat(player, data.message);
                break;
            case "register":
                this.handleRegistration(player, data.username, data.email, data.password);
                break;
            case "login":
                this.handleLogin(player, data.usernameEmail, data.password, data.rememberMe);
                break;
            case "loginCookie":
                this.handleLoginCookie(player, data.cookie);
                break;
            case "logout":
                this.handleLogout(player);
                break;
            case "captcha":
                this.handleCaptcha(player, data.token);
                break;
            default:
                break;
        }
    }

    resetInputs(player) {
        player.resetInputs();
    }

    handleKeyInput(player, key, pressed) {
        if (player.spawned && player.spawnProt) {
            player.spawnProt = 0;
            player.miscUpdates.set("spawnProt", 0);
        }
        let input = [this.inputTypes[key], Date.now()]
        pressed ? player.keyDowns.push(input) : player.keyUps.push(input);
        player.lastInput = Date.now();
        player.afk = false;
    }

    handleMouseInput(player, x, y, angle) {
        if (!player.inGame) return;
        player.mouse = { x, y, angle };
        let playerAngle = Math.round(angle + Math.asin(18 / Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))) * 180 / Math.PI) + 1;
        if (playerAngle) {
            playerAngle %= 360;
            player.angle = playerAngle;
        }
    }

    handleSpawn(player) {
        if (!player.spawned) {
            player.registeredEvents.push("spawned");
            player.spawned = true;
        }
    }

    handleUpgrade(player, upgrade) {
        if (!player.spawned || player.skillPoints == 0 || !(upgrade >= 1 && upgrade <= 5) || Object.values(player.upgrades)[upgrade - 1] >= 5) return;
        player.skillPoints--;
        player.formUpdates.set("chosenUpgrade", upgrade);
        player.formUpdates.set("skillPoints", player.skillPoints);
        switch (upgrade) {
            case 1:
                player.upgrades.speed++;
                break;
            case 2:
                player.upgrades.reload++;
                player.weapon.updateTicksBeforeReload();
                break;
            case 3:
                player.upgrades.mags++;
                player.weapon.updateMaxAmmo();
                player.weapon.startReload();
                player.formUpdates.set("newAmmoCapacity", player.weapon.maxAmmo);
                player.miscUpdates.set("reloading", player.weapon.reloading);
                break;
            case 4:
                player.upgrades.view++;
                player.viewbox.x += 147;
                player.viewbox.y += 83;
                player.formUpdates.set("vx", player.viewbox.x);
                player.formUpdates.set("vy", player.viewbox.y);
                break;
            case 5:
                player.upgrades.heal++;
                break;
        }
    }

    handleGunUpgrade(player, weaponID) {
        if (!player.inGame || !player.weaponUpgradeAvailable || !(weaponID >= 0 && weaponID <= 3)) return;
        player.setWeapon(["pistol", "assault", "sniper", "shotgun"][weaponID]);
        player.weaponUpgradeSelected = 1;
        player.weaponUpgradeAvailable = 0;
        player.miscUpdates.set("weapon", player.weapon.id);
        player.miscUpdates.set("reloading", player.weapon.reloading);
        player.formUpdates.set("weaponChosen", player.weapon.id);
        player.formUpdates.set("weaponUpgradeAvailable", player.weaponUpgradeAvailable);
        player.formUpdates.set("ammo", player.weapon.ammo);
        player.formUpdates.set("newAmmoCapacity", player.weapon.maxAmmo);
        if (player.level >= worldValues.upgradesAtLevel.attachment) {
            player.weaponAttachmentAvailable = 1;
            player.formUpdates.set("attachmentAvailable", player.weaponAttachmentAvailable);
        }
    }

    handlePerkUpgrade(player, perkID) {
        if (!player.inGame || !player.perkUpgradeAvailable || perkID < 1 || perkID > PerkList.length) return; 
        player.perkID = perkID;
        player.perkUpgradeSelected = 1;
        player.perkUpgradeAvailable = 0;
        player.currentCooldown = 0;
        player.formUpdates.set("perkChosen", player.perkID);
        player.formUpdates.set("perkUpgradeAvailable", player.perkUpgradeAvailable);
    }

    handleAttachmentUpgrade(player, attachmentID) {
        if (!player.inGame || !player.weaponAttachmentAvailable) return;
        if (!player.weapon.setAttachment(attachmentID)) return;
        player.stats.attachmentID = player.weapon.attachment.id;
        player.weaponAttachmentSelected = 1;
        player.weaponAttachmentAvailable = 0;
        player.formUpdates.set("attachmentChosen", player.weapon.attachment.id);
        player.formUpdates.set("attachmentAvailable", player.weaponAttachmentAvailable);
    }

    handleChat(player, msg) {
        if (!player.spawned) return;
        if (msg.length > 32) msg = msg.substr(0, 32);
        let filtered = msg.replace(/[^a-zA-Z0-9\t\n .,/<>?;:"'`~!@#$%^&*()\[\]{}_+=\\-]/g, "") + " ";
        if (filtered.startsWith("/") && player.perms > 0) {
            let args = filtered.trim().split(" ");
            let cmd = args.shift().replace("/", "");
            //note: you can substitute spaces with underscores in commands that take player names
            if (commands.has(cmd)) {
                commands.get(cmd).exec(args, player, this);
            } else {
                player.packet.serverMessage(Packet.createServerMessage("misc", "(/) Command not recognized!"));
            }
            return;
        }
        player.miscUpdates.set("chat", filtered);
    }

    handleRegistration(player, username, email, password) {
        if (player.spawned) return;
        let errors = [];
        let usernameIsAlpha = new RegExp(/^[a-z0-9]+$/i).test(username); 
        let emailIsValid = isEmail(email);
        if (!usernameIsAlpha) {
            errors[1] = "Username must be alphanumeric: [a-z0-9]";
        } else if (username.length < 3 ) {
            errors[1] = "Username must be at least 3 characters.";
        } else if (username.length > 12) {
            errors[1] = "Username may not be more than 12 characters.";
        }
        if (!emailIsValid) {
            errors[2] = "Email is not valid.";
        }
        if (password.length < 6) {
            errors[3] = "Passwords can not be shorter than 6 characters.";
        } else if (password.length > 200) {
            errors[3] = "What is wrong with you?";
        }
        if (!errors.length) {
            this.postRequest('/auth/register', {
                username, email, password
            }).then(resp => {
                if (!resp.data.error) {
                    player.loggedIn = 1;
                    player.username = username;
                    player.cookie = resp.data.cookie;
                } else {
                    errors[resp.data.code] = resp.data.desc;
                }
                player.packet.auth(player, errors);
            }).catch(e => {});
        } else {
            player.packet.auth(player, errors);
        }
    }

    handleLogin(player, usernameEmail, password, rememberMe) {
        if (player.spawned) return;
        let errors = [];
        if (password.length > 200 || usernameEmail.length > 255) {
            errors[0] = "The provided username and password does not exist in our database.";
        }
        if (!errors.length) {
            this.postRequest('/auth/login', {
                usernameEmail, password
            }).then(resp => {
                if (!resp.data.error) {
                    player.loggedIn = 1;
                    player.username = resp.data.username;
                    player.perms = resp.data.perms;
                    if (player.perms > 0) player.packet.slashCommands(commandsArr);
                    if (rememberMe) player.cookie = resp.data.cookie;
                } else {
                    errors[0] = resp.data.desc;
                }
                player.packet.auth(player, errors);
            }).catch(e => {
                errors[0] = "The database is currently offline.";
                player.packet.auth(player, errors);
            });
        } else {
            player.packet.auth(player, errors);
        }
    }

    handleLoginCookie(player, cookie) {
        this.postRequest('/auth/loginCookie', {
            cookie
        }).then(resp => {
            if (!resp.data.error) {
                player.loggedIn = 1;
                player.username = resp.data.username;
                player.perms = resp.data.perms;
                if (player.perms > 0) player.packet.slashCommands(commandsArr);
                player.cookie = resp.data.cookie;
                player.packet.auth(player);
            }
        }).catch(e => {});
    }

    handleLogout(player, override) {
        if (player.spawned && !override) return;
        player.loggedIn = 0;
        let tmpUsername = player.username;
        player.username = "Guest " + player.guestName;
        player.perms = 0;
        player.cookie = "";
        player.saveCookie = 0;
        this.postRequest('/auth/logout', {
            username: tmpUsername
        }).then(resp => {
            player.packet.auth(player);
        }).catch(e => {
            player.packet.auth(player);
        });
    }

    async handleCaptcha(player, token) {
        if (!process.env.captchaKey) return;
        let params = `?secret=${process.env.captchaKey}&response=${token}&remoteip=${player.socket.ip}`;
        let resp = await axios.post("https://www.google.com/recaptcha/api/siteverify" + params);
        if (!resp.data.success || resp.score <= 0.3) {
            player.socket.kick();
            return;
        }
        player.verified = true;
    }

    handlePlayerJoin(player) {
        player.team = this.getTeam();
        player.teamCode = player.team.id;
        player.team.addPlayer(player);
        this.allocateGuestName(player);
        player.loadingScreenDir = Math.floor(Math.random() * 8);
        player.registeredEvents.push("connected");
    }

    handlePlayerLeave(player) {
        player.team.removePlayer(player);
        if (Date.now() - player.stats.spawnTime > 60 * 1000) {
            this.onPlayerDeath(player);
        }
        player.registeredEvents.push("disconnected");
    }
}

module.exports = World;