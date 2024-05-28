class World {
    inputTypes = ["left", "right", "up", "down", "reload", "space", "mouse"];
    constructor(radius, points, players) {
        this.radius = radius;
        this.points = points.map((coords, i) => this.coordsToPoint(coords, i));
        this.players = players;
        this.tickCount = 0;
    }

    evalTick() {
        
    }

    handleMessage(player, data) {
        switch (data.type) {
            case "keypress":
                this.handleKeyInput(player, data.key, data.pressed);
            case "mouse":
                this.handleMouseInput(player, data.x, data.y, angle);
            case "spawn":
                this.handleSpawn(player);
        }
    }

    handleKeyInput(player, key, pressed) {
        player.inputs[this.inputTypes[key]] = pressed;
    }

    handleMouseInput(player, x, y, angle) {
        player.mouse = { x, y, angle };
    }

    handleSpawn(player) {
        
    }

    handlePlayerLeave(player) {
        
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