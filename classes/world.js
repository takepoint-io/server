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
        this.teams = [
            new Team("red", 0), new Team("green", 1), new Team("blue", 2)
        ];
        this.players = players;
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
                        break;
                    case "connected":
                        for (let point of this.points) {
                            player.packet.pointInfo(point);
                        }
                        player.packet.viewbox(player);
                        break;
                }
            }
        }
    }

    tick() {
        //updates
        for (let [_playerID, player] of this.players) {
            this.updatePlayerPosition(player);
            if (player.spawned) {
                this.updatePlayerVelocity(player);
            }
        }
        this.updateQuadtree();
        //collision checking

        //update points
        for (let point of this.points) {
            let res = this.queryPlayers(new Circle(point.x, point.y, point.radius + 50))
                .map(p => this.players.get(p.data.id))
                .filter(p => p.spawned && Util.hypot(p.x - point.x, p.y - point.y) < point.radius + p.radius);
            if (res.length) {
                let statusChanged = point.update(res);
                if (statusChanged) {
                    //award the points
                    if (point.neutralizedThisTick) {
                        for ()
                    }
                    for (let [_playerID, player] of this.players) {
                        player.packet.pointUpdate(point);
                        if (point.neutralizedThisTick) player.packet.pointInfo(point);
                    }
                }
            }
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
                continue;
            }
            player.packet.playerUpdate(player);
            if (player.updatedFields.size > 0) {
                player.packet.playerMiscData(player);
            }
            player.registeredEvents = [];
            player.updatedFields.clear();
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

    collisionCheck() {

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
            player.updatedFields.set("spawnProt", 0);
        }
        player.inputs[this.inputTypes[key]] = pressed;
        player.lastInput = Date.now();
    }

    handleMouseInput(player, x, y, angle) {
        player.mouse = { x, y, angle };
    }

    handleSpawn(player) {
        if (!player.spawned) {
            player.registeredEvents.push("spawned");
            player.spawned = true;
        }
    }

    handlePlayerJoin(player) {
        player.team = this.getTeam();
        player.teamCode = player.team.id;
        player.team.addPlayer(player);
        player.loadingScreenDir = Math.floor(Math.random() * 8);
        player.registeredEvents.push("connected");
    }

    handlePlayerLeave(player) {
        player.team.removePlayer(player);
        player.registeredEvents.push("disconnected");
    }
}

module.exports = World;