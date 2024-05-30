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
                    player.packet.pointInfo(this.points);
                    
                    // setTimeout(() => {
                    //     player.sendUpdate(new TextEncoder().encode("b,74,0,4,0,4,0,|f||c,74|pu,3,56.33|pu,5,99.66|pu,14,90.33|pu,17,14.00|mc,0:25,1:30,2:40,3:5||d,98,2,0,-21,63,25,146,100.000000,100,0,0,38,0,Guest Sabik,0,100|d,76,2,3,138,379,25,35,100.000000,100,0,0,42,0,Guest Minos,0,100|b,98,-21,63,0,0,146,|c,98|b,76,138,379,5,4,35,|c,76|v,74,1468,826||pi,0,2,0,0,250,100.0,2,1|pi,1,0,867,496,170,100.0,0,1|pi,2,2,-867,498,170,100.0,2,1|pi,3,0,-2,-999,170,56.33,0,1|pi,4,0,2000,0,170,100.0,0,1|pi,5,2,995,1734,170,99.66,2,1|pi,6,1,-992,1736,170,100.0,1,1|pi,7,2,-1999,3,170,100.0,2,1|pi,8,1,-997,-1733,170,100.0,1,1|pi,9,0,1006,-1728,170,100.0,0,1|pi,10,2,2603,1490,170,100.0,2,1|pi,11,2,1030,2817,170,100.0,2,1|pi,12,1,-1026,2818,170,100.0,1,1|pi,13,1,-2601,1494,170,100.0,1,1|pi,14,2,-2952,-532,170,90.33,2,1|pi,15,1,-1938,-2289,170,100.0,1,1|pi,16,1,-7,-2999,170,100.0,1,1|pi,17,3,1927,-2299,170,14.00,1,1|pi,18,0,2955,-516,170,100.0,0,1||p,0|\x00"))
                    // }, 500);
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
            if (player.packet.data.packetList.length == 0) continue;
            //player.sendUpdate(player.packet.enc());
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
            owner: 3,
            percentage: 0,
            radius: index ? worldValues.pointRadius : 500,
            id: index
        }
    }
}

module.exports = World;