class World {
    constructor(radius, points) {
        this.radius = radius;
        this.points = points.map((coords, i) => this.coordsToPoint(coords, i));
        this.players = [];
        this.tickCount = 0;
    }

    coordsToPoint(point, index) {
        return { 
            x: point[0],
            y: point[1],
            id: index
        }
    }
}

module.exports = World;