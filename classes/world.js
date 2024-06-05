const { QuadTree, Box, Circle  } = require('js-quadtree');
const Packet = require('./packet');
const Point = require('./point');
const Team = require('./team');
const Util = require('./util');
const { worldValues } = require('../data/values.json');

class World {
    inputTypes = ["left", "right", "up", "down", "reload", "space", "mouse"];
    constructor(players) {
        this.radius = worldValues.radius;
        this.points = worldValues.points.coords.map((coords, i) => new Point(coords, i));
        this.pointStatus = [0, 0, 0];
        this.teams = [
            new Team("red", 0), new Team("green", 1), new Team("blue", 2)
        ];
        this.leaderboard = [];
        this.players = players;
        this.guestNames = worldValues.guestNames.map(name => this.initGuestName(name));
        this.objects = new Map();
        this.bullets = new Map();
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
                }
            }
        }
    }

    tick() {
        //individual player updates that aren't affected by other events
        for (let [_playerID, player] of this.players) {
            this.updatePlayerPosition(player);
            if (player.spawned) {
                this.updatePlayerVelocity(player);
                this.updatePlayerHealth(player);
            }
        }
        this.updateQuadtree();
        //collision checking

        //update points
        this.updatePoints();

        //update weapons
        this.updateWeapons();

        //update each player's viewbox
        for (let [_playerID, player] of this.players) {
            this.updateView(player);
        }

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
        
        /*
        vector<int> playersInRange = getObjectsInGrid(playerGrid, gridCollisionLimits);

        for(int checkingPlayerId : playersInRange){
            Player* checkingPlayer = &playerObjects.at(checkingPlayerId);
            if(mTeamCode == 0 || mTeamCode > 0 && checkingPlayer->mTeamCode != mTeamCode){
                if(checkingPlayer->mId != mId && checkingPlayer->inGame){
                    if(checkingPlayer->inCollisionRangeOf(mX, mY, speedBuffer)){
                        int distance = sqrt(pow((checkingPlayer->mX - testXPosition), 2) + pow((checkingPlayer->mY - testYPosition), 2));
                        if(distance < mRadius + checkingPlayer->mRadius){
                            int checkingPlayerSpdX = checkingPlayer->mSpdX;
                            int checkingPlayerSpdY = checkingPlayer->mSpdY;
                            checkingPlayer->mSpdX = mSpdX;
                            checkingPlayer->mSpdY = mSpdY;
                            mSpdX = checkingPlayerSpdX;
                            mSpdY = checkingPlayerSpdY;
                            break;
                        }
                    }
                }
            }
        }*/
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
            player.packet.playerUpdate(player);
            if (player.miscUpdates.size > 0) {
                player.packet.playerMiscData(player);
            }
            if (player.formUpdates.size > 0) {
                player.packet.upgrades(player);
            }
            player.weapon.postTick();
            player.registeredEvents = [];
            player.miscUpdates.clear();
            player.formUpdates.clear();
        }
        for (let point of this.points) {
            point.capturedThisTick = false;
            point.neutralizedThisTick = false;
        }
    }

    updateQuadtree() {
        this.tree.clear();
        for (let [_playerID, player] of this.players) {
            if (!player.spawned) continue;
            this.addCircleToTree(player);
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
                .filter(p => p.spawned && Util.hypot(p.x - point.x, p.y - point.y) < point.radius + p.radius);
            if (res.length) {
                let statusChanged = point.update(res);
                if (statusChanged) {
                    //award the points
                    if (point.neutralizedThisTick) {
                        for (let player of res) {
                            player.addScore(worldValues.scoreAwards.pointNeutrailzed * point.scoreMultiplier);
                            player.packet.serverMessage(Packet.createServerMessage("pointNeutralized"));
                        }
                    } else if (point.capturedThisTick) {
                        this.pointStatus = [
                            Point.ownedByTeam(0, this.points),
                            Point.ownedByTeam(1, this.points),
                            Point.ownedByTeam(2, this.points)
                        ];
                        for (let player of res) {
                            player.addScore(worldValues.scoreAwards.pointTaken * point.scoreMultiplier);
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

    collisionCheck() {

    }

    updateWeapons() {
        for (let [_playerID, player] of this.players) {
            if (!player.spawned) continue;
            let weapon = player.weapon;
            if (player.inputs.mouse) {
                let bullet = weapon.attemptFire();
                if (bullet) {
                    player.miscUpdates.set("firing", weapon.firing); 
                    player.formUpdates.set("ammo", weapon.ammo);
                }
            }
            if (weapon.ticksSinceFire == weapon.ticksBeforeFire - 1) {
                player.miscUpdates.set("firing", weapon.firing);
            }
            if (!weapon.reloading && ((player.inputs.reload && weapon.ammo < weapon.maxAmmo) || weapon.ammo == 0)) {
                player.reloadWeapon();
            }
            if (weapon.reloading && weapon.ticksSinceReload >= weapon.ticksBeforeReload) {
                weapon.finishReload();
                player.miscUpdates.set("reloading", weapon.reloading);
                player.formUpdates.set("ammo", weapon.ammo);
            }
        }
    }

    updateView(player) {
        let viewbox = this.queryPlayerView(player);
        for (let i = 0; i < viewbox.length; i++) {
            let item = viewbox[i];
            switch (item.data.type) {
                case 0:
                    let playerTwo = this.players.get(item.data.id);
                    if (player.id == playerTwo.id) break;
                    if (!player.playerPool.has(playerTwo.id)) {
                        player.playerPool.set(playerTwo.id, playerTwo);
                        player.packet.playerJoin(playerTwo);
                    }
                    if (playerTwo.miscUpdates.size > 0) {
                        player.packet.playerMiscData(playerTwo);
                    }
                    player.packet.playerUpdate(playerTwo);
                    break;
                default:
                    break;
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
            player.spdX = Math.round(scrollX * speed);
            player.spdY = Math.round(scrollY * speed);

            if (Math.abs(player.x) > 4000 || Math.abs(player.y) > 4000) player.loadingScreenDir = Math.floor(Util.angle(player.x, player.y) / 45);
        }
        player.x += Math.round(player.spdX);
        player.y += Math.round(player.spdY);
    }

    updatePlayerVelocity(player) {
        //Update velocity based on player input, 2x acceleration if opposite dir
        let signX = Math.sign(player.spdX);
        let signY = Math.sign(player.spdY);
        if (player.inputs.left  && !player.inputs.right) player.spdX -= worldValues.movement.acceleration * (signX == 1 ? 2 : 1);
        if (player.inputs.right && !player.inputs.left ) player.spdX += worldValues.movement.acceleration * (signX == 1 ? 1 : 2);
        if (player.inputs.up    && !player.inputs.down ) player.spdY -= worldValues.movement.acceleration * (signY == 1 ? 2 : 1);
        if (player.inputs.down  && !player.inputs.up   ) player.spdY += worldValues.movement.acceleration * (signY == 1 ? 1 : 2);

        //Apply a resistive force that increases as velocity increases
        let resistX = worldValues.movement.dragCoefficient * (player.spdX / player.maxSpeed) + Math.sign(player.spdX) * worldValues.movement.baseResistiveForce;
        let resistY = worldValues.movement.dragCoefficient * (player.spdY / player.maxSpeed) + Math.sign(player.spdY) * worldValues.movement.baseResistiveForce;

        if (Math.abs(resistX) > Math.abs(player.spdX)) player.spdX = 0;
        else player.spdX -= resistX;
        if (Math.abs(resistY) > Math.abs(player.spdY)) player.spdY = 0;
        else player.spdY -= resistY;

        player.spdX = Util.clamp(player.spdX, -player.maxSpeed, player.maxSpeed);
        player.spdY = Util.clamp(player.spdY, -player.maxSpeed, player.maxSpeed);
        player.normalizeSpeed();
    }

    updatePlayerHealth(player) {
        let healedThisTick = 0.04 + 0.02 * player.upgrades.regen;
        player.accumulatedHealth += healedThisTick;
        if (player.accumulatedHealth < 1) return;
        player.health = Util.clamp(player.health + Math.floor(player.accumulatedHealth), 0, player.maxHealth);
        player.accumulatedHealth -= Math.floor(player.accumulatedHealth);
        player.miscUpdates.set("hp", player.health);
    }

    getSpawnPoint(teamCode) {
        //choose point on edge if the team controls no points
        let angle = Math.random() * Math.PI * 2;
        let x = Math.cos(angle) * (this.radius - 100);
        let y = Math.sin(angle) * (this.radius - 100);
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
    }

    handleMouseInput(player, x, y, angle) {
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
        if (!player.spawned || player.skillPoints == 0 || !(upgrade > 0 && upgrade < 6) || Object.values(player.upgrades)[upgrade - 1] >= 5) return;
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
                player.formUpdates.set("newAmmoCapacity", player.weapon.maxAmmo);
                player.reloadWeapon();
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

    handleChat(player, msg) {
        if (player.spawned) {
            if (msg.length > 32) msg = msg.substr(0, 32);
            let filtered = msg.replace(/[^a-zA-Z0-9\t\n ./<>?;:"'`~!@#$%^&*()\[\]{}_+=\\-]/g, "") + " ";
            player.miscUpdates.set("chat", filtered);
        }
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