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
            arePointsEqual: (point1, point2) => { 
                return point1.data.type == point2.data.type && point1.data.id == point2.data.id;
            }
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
                if (event == "spawned") {
                    player.respawn(this);
                }
                if (event == "connected") {
                    player.onConnect(this);
                    this.removeFromTree(player);
                }
                if (event == "disconnected") {
                    this.players.delete(player.id);
                    break;
                }
            }
        }
    }

    tick() {
        for (let [_playerID, player] of this.players) {
            if (!player.spawned) continue;
            player.x += Math.round(player.spdX);
            player.y += Math.round(player.spdY);

            //Update speed based on player input, 2x acceleration if opposite dir
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
        this.updateQuadtree();
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
            player.packet.playerUpdate(player);
            player.registeredEvents = [];
        }
    }

    updateQuadtree() {  
        let tree = this.tree;
        for (let player in this.players) {
            tree.insert(new Circle(player.x, player.y, player.radius, { id: player.id, type: player.type }));
        }
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
        player.registeredEvents.push("connected");
    }

    handlePlayerLeave(player) {
        player.team.removePlayer(player);
        player.registeredEvents.push("disconnected");
    }
}

module.exports = World;