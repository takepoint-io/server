const { QuadTree, Box, Circle } = require('js-quadtree');
const Packet = require('./packet');
const Point = require('./point');
const Bullet = require('./bullet');
const Team = require('./team');
const Perks = [
    'barrier',
    'health'
].map(e => require('./objects/' + e));
const Util = require('./util');
const { worldValues } = require('../data/values.json');

class World {
    inputTypes = ["left", "right", "up", "down", "reload", "space", "mouse"];
    constructor(players, devMode) {
        this.devMode = devMode;
        this.radius = worldValues.radius;
        this.points = worldValues.points.coords.map((coords, i) => new Point(coords, i));
        this.pointStatus = [0, 0, 0];
        this.teams = [
            new Team("red", 0), new Team("green", 1), new Team("blue", 2)
        ];
        this.leaderboard = [];
        this.players = players;
        this.guestNames = worldValues.guestNames.map(name => this.initGuestName(name));
        this.tickCount = 0;
        this.tree = new QuadTree(new Box(-4250, -4250, 8500, 8500), { 
            arePointsEqual: (point1, point2) => point1.data.type == point2.data.type && point1.data.id == point2.data.id
        });
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
            player.packet = new Packet();
            player.socket.packetsThisTick = 0;
            for (let event of player.registeredEvents) {
                switch (event) {
                    case "spawned":
                        player.respawn(this);
                        if (this.devMode) player.addScore(20000);
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
                        break;
                    case "afk":
                        player.packet.serverMessage(Packet.createServerMessage("afk", 60 * 25));
                        break;
                }
            }
        }
    }

    tick() {
        this.runCollisions();
        for (let [_playerID, player] of this.players) {
            this.updatePlayerPosition(player);
            if (player.spawned) {
                this.updatePlayerVelocity(player);
                this.updatePlayerHealth(player);
            }
        }
        this.updatePoints();
        this.updatePerks();
        this.updateBullets();
        this.updateWeapons();
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
                this.removeFromTree(player);
                for (let [_playerID, player] of this.players) {
                    player.packet.playersOnline(this.players.size);
                }
                continue;
            }
            else if (player.registeredEvents.includes("despawned")) {
                player.spawnTimeout = 50;
                player.informedOfRespawn = false;
                player.packet.playerExit(player.id);
                player.stats.setTimeAlive();
                player.packet.stats(player);
            }
            player.packet.playerUpdate(player);
            if (player.miscUpdates.size > 0) {
                player.packet.playerMiscData(player);
            }
            if (player.formUpdates.size > 0) {
                player.packet.upgrades(player);
            }
            player.weapon.postTick();
            player.registeredEvents = [];
            player.collisions = [];
            player.miscUpdates.clear();
            player.formUpdates.clear();
            if (player.spawnTimeout > 0) player.spawnTimeout--;
            if (player.spawnTimeout == 0 && !player.informedOfRespawn) {
                player.packet.respawnButtonAvailable();
                player.informedOfRespawn = true;
            }
        }
        for (let point of this.points) {
            point.postTick();
        }
    }

    updateQuadtree() {
        this.tree.clear();
        for (let [_playerID, player] of this.players) {
            if (!player.spawned) continue;
            this.addCircleToTree(player);
        }
        for (let [_bulletID, bullet] of Bullet.bullets) {
            this.addEntityToTree(bullet);
        }
    }

    queryPlayers(query) {
        return this.tree.query(query).filter(e => e.data.type == 0);
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
        }
    }

    updateLeaderboard() {
        let playerArray = Array.from(this.players, ([n,v]) => v).filter(p => p.spawned);
        this.leaderboard = playerArray.sort((a, b) => b.score - a.score).slice(0, 10);
        for (let [_playerID, player] of this.players) {
            player.packet.leaderboard(this.leaderboard);
        }
    }

    updatePoints() {
        for (let point of this.points) {
            let res = this.queryPlayers(new Circle(point.x, point.y, point.radius + 50))
                .map(p => this.players.get(p.data.id))
                .filter(p => p.spawned && !p.spawnProt && Util.hypot(p.x - point.x, p.y - point.y) < point.radius + p.radius);
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
                } else if (entity.type == 1) {
                    //TODO: add other entities
                }
                if (entity.teamCode != bullet.teamCode) {
                    let segment = {
                        p1: { x: bullet.x, y: bullet.y },
                        p2: { x: bullet.x + bullet.velocity.x, y: bullet.y + bullet.velocity.y }
                    };
                    let hit = Util.circleLineSegmentIntersect(entity.testPosition, segment, entity.radius + bullet.size);
                    if (hit) hits.push({ entity: entity, pos: hit });
                }
            }
            if (hits.length == 0) continue;
            bullet.player.stats.bulletsHit++;
            bullet.shouldDespawn = true;
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
                    if (player.shield > 0) {
                        player.shield = Util.clamp(player.shield - bullet.dmg, 0, player.maxShield);
                        player.miscUpdates.set("shield", player.shield);
                    }
                    if (player.shield == 0) {
                        let tmpHealth = player.health;
                        player.health = Util.clamp(player.health - bullet.dmg, 0, player.maxHealth);
                        player.miscUpdates.set("hp", player.health);
                        player.beingHit = 1;
                        player.miscUpdates.set("beingHit", player.beingHit);
                        let delta = tmpHealth - player.health;
                        if (delta > 0) bullet.player.addScore(delta);
                        if (player.health == 0) this.onPlayerDeath(player, bullet.player);
                    }
                    bullet.player.packet.hitMarker(closest.pos);
                    break;
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
                    player.miscUpdates.set("firing", weapon.firing); 
                    player.formUpdates.set("ammo", weapon.ammo);
                }
            }
            if (weapon.ticksSinceFire == weapon.ticksBeforeFire - 1) {
                player.miscUpdates.set("firing", weapon.firing);
            }
            if (!weapon.reloading && ((player.inputs.reload && weapon.ammo < weapon.maxAmmo) || (weapon.ammo == 0 && weapon.ticksSinceFire >= weapon.ticksBeforeFire))) {
                weapon.startReload();
                player.miscUpdates.set("reloading", player.weapon.reloading);
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
            if (player.perkCooldown > 0) player.perkCooldown--;
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
        let bulletsChecked = {};
        for (let i = 0; i < viewbox.length; i++) {
            let entity = viewbox[i];
            switch (entity.data.type) {
                case 0:
                    let playerTwo = this.players.get(entity.data.id);
                    if (player.id == playerTwo.id || !playerTwo.spawned) break;
                    if (!player.playerPool.has(playerTwo.id)) {
                        player.playerPool.set(playerTwo.id, playerTwo);
                        player.packet.playerJoin(playerTwo);
                    }
                    if (playerTwo.miscUpdates.size > 0) {
                        player.packet.playerMiscData(playerTwo);
                    }
                    player.packet.playerUpdate(playerTwo);
                    playersChecked[playerTwo.id] = true;
                    break;
                case 2:
                    let bullet = Bullet.bullets.get(entity.data.id);
                    if (!player.bulletPool.has(bullet.id)) {
                        player.bulletPool.set(bullet.id, bullet);
                        player.packet.bulletJoin(bullet);
                    }
                    player.packet.bulletUpdate(bullet);
                    bulletsChecked[bullet.id] = true;
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
        for (let [_bulletID, bullet] of player.bulletPool) {
            if (!bulletsChecked[_bulletID]) {
                player.packet.bulletExit(_bulletID);
                player.bulletPool.delete(_bulletID);
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

        //Update velocity based on player input
        if (player.inputs.left  && !player.inputs.right) player.spdX -= (player.maxSpeed + player.spdX) / 8;
        if (player.inputs.right && !player.inputs.left ) player.spdX += (player.maxSpeed - player.spdX) / 8;
        if (player.inputs.up    && !player.inputs.down ) player.spdY -= (player.maxSpeed + player.spdY) / 8;
        if (player.inputs.down  && !player.inputs.up   ) player.spdY += (player.maxSpeed - player.spdY) / 8;

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
            let healedThisTick = 0.04 + 0.02 * player.upgrades.regen;
            player.accumulatedHealth += healedThisTick;
            if (player.accumulatedHealth < 1) return;
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
        player.packet.serverMessage(Packet.createServerMessage("killed", killer.username));

        killer.kills++;
        killer.packet.serverMessage(Packet.createServerMessage("kill", player.username));
    }

    getSpawnPoint(teamCode) {
        let spawnPointData = {
            offsetX: 0,
            offsetY: 0, 
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
                if (x ** 2 + y ** 2 < Math.sqrt(point.radius)) {
                    spawnPointData.offsetX = point.x + x;
                    spawnPointData.offsetY = point.y + y;
                    break;
                }
            }
        }
        else {
            //choose point on edge if the team controls no points
            spawnPointData.radius = this.devMode ? 100 : this.radius - 100;
        }
        let x = Math.cos(spawnPointData.angle) * spawnPointData.radius + spawnPointData.offsetX;
        let y = Math.sin(spawnPointData.angle) * spawnPointData.radius + spawnPointData.offsetY;
        return [Math.floor(x), Math.floor(y)];
    }

    getTeam() {
        let sortedTeams = this.teams.sort((a, b) => a.players.size - b.players.size);
        let candidates = sortedTeams.filter(team => team.players.size == sortedTeams[0].players.size);
        return candidates[Math.floor(Math.random() * candidates.length)];
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
            case "chat":
                this.handleChat(player, data.message);
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
        player.inputs[this.inputTypes[key]] = pressed;
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
                player.upgrades.regen++;
                break;
        }
    }

    handleGunUpgrade(player, weaponID) {
        if (!player.inGame || !player.weaponUpgradeAvailable || !(weaponID >= 0 && weaponID <= 4)) return;
        player.setWeapon(["pistol", "assault", "sniper", "shotgun"][weaponID]);
        player.weaponUpgradeSelected = 1;
        player.weaponUpgradeAvailable = 0;
        player.miscUpdates.set("weapon", player.weapon.id);
        player.miscUpdates.set("reloading", player.weapon.reloading);
        player.formUpdates.set("weaponChosen", player.weapon.id);
        player.formUpdates.set("weaponUpgradeAvailable", player.weaponUpgradeAvailable);
        player.formUpdates.set("ammo", player.weapon.ammo);
        player.formUpdates.set("newAmmoCapacity", player.weapon.maxAmmo);
    }

    handlePerkUpgrade(player, perkID) {
        if (!player.inGame || !player.perkUpgradeAvailable || perkID < 1 || perkID > Perks.length) return; 
        player.perkID = perkID;
        player.perkUpgradeSelected = 1;
        player.perkUpgradeAvailable = 0;
        player.perkCooldown = 0;
        player.formUpdates.set("perkChosen", player.perkID);
        player.formUpdates.set("perkUpgradeAvailable", player.perkUpgradeAvailable);
    }

    handleChat(player, msg) {
        if (!player.spawned) return;
        if (msg.length > 32) msg = msg.substr(0, 32);
        let filtered = msg.replace(/[^a-zA-Z0-9\t\n ./<>?;:"'`~!@#$%^&*()\[\]{}_+=\\-]/g, "") + " ";
        player.miscUpdates.set("chat", filtered);
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
        player.registeredEvents.push("disconnected");
    }
}

module.exports = World;