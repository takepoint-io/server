const { worldValues: { points } } = require('../data/values.json');

class Point {
    constructor(coords, id) {
        this.x = coords[0];
        this.y = coords[1];
        this.owner = 3;
        this.capturer = 3;
        this.ticks = 0;
        this.ticksToCap = points.ticksToCap;
        this.id = id;
        this.scoreMultiplier = this.id == 0 ? 2 : 1
        this.radius = this.scoreMultiplier == 1 ? points.pointRadius : points.bigPointRadius;
    }

    update(playersOnPoint) {
        //0 - nothing happened, 1 - point neutralized, 2 - point taken, 3 - updated status
        let numCapturing = playersOnPoint.length;
        if (numCapturing == 0) return 0;
        let teamCode = playersOnPoint[0].teamCode;
        //only update point status if all players in the point are of the same team
        if (numCapturing == playersOnPoint.filter(p => p.teamCode == teamCode).length) {
            if (this.owner != teamCode) {
                if (this.capturer != teamCode) {
                    if (this.ticks <= 0) {
                        this.ticks = 0;
                        this.capturer = teamCode;
                        this.owner = 3;
                        this.ticks += numCapturing;
                        return 1;
                    }
                    this.ticks -= numCapturing;
                    return 3;
                }
                else if (this.capturer == teamCode) {
                    this.ticks += numCapturing;
                    if (this.ticks >= this.ticksToCap) {
                        this.ticks = this.ticksToCap;
                        this.owner = teamCode;
                        return 2;
                    }
                    return 3;
                }
            }
            else {
                if (this.ticks == this.ticksToCap) {
                    return 0;
                }
                ticks += numCapturing;
                return 3;
            }
        }
        return 0;
    }

    get percentCaptured() {
        return (this.ticks / this.ticksToCap) * 100;
    }
}

module.exports = Point;