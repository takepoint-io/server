const Packet = require('./packet');
const Team = require('./team');
const { worldValues } = require('../data/values.json');

class World {
    inputTypes = ["left", "right", "up", "down", "reload", "space", "mouse"];
    constructor(players) {
        this.radius = worldValues.radius
        this.points = worldValues.points.map((coords, i) => this.coordsToPoint(coords, i));
        this.teams = [
            new Team("red", 0), new Team("green", 1), new Team("blue", 2)
        ];
        this.players = players;
        this.tickCount = 0;
    }

    evalTick() {
        this.preTick();

        this.sendUpdates();
    }

    preTick() {
        for (let [_playerID, player] of this.players) {
            player.packet = new Packet();
            player.socket.packetsThisTick = 0;
            for (let event of player.registeredEvents) {
                if (event == "spawned") {
                    [player.x, player.y] = this.getSpawnPoint(player.teamCode);
                    player.resetInputs();
                }
                if (event == "connected") {
    
                }
                if (event == "disconnected") {
                    this.players.delete(player.id);
                    break;
                }
            }
            player.registeredEvents = [];
        }
    }

    sendUpdates() {
        for (let [_playerID, player] of this.players) {
            this.buildPacketFor(player);
        }
    }

    buildPacketFor(player) {
        
    }

    getSpawnPoint(teamCode) {
        //choose point on edge if the team controls no points
        let angle = Math.random() * Math.PI * 2;
        let x = Math.cos(angle) * this.radius;
        let y = Math.sin(angle) * this.radius;
        return [x, y];
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

    coordsToPoint(point, index) {
        return { 
            x: point[0],
            y: point[1],
            owner: 0,
            percentage: 0,
            id: index
        }
    }
}

module.exports = World;