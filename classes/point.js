const { worldValues: { points } } = require('../data/values.json');

class Point {
    constructor(coords, id) {
        this.x = coords[0];
        this.y = coords[1];
        this.owner = 3;
        this.capturer = 3;
        this.capturedThisTick = false;
        this.neutralizedThisTick = false;
        this.ticks = 0;
        this.ticksToCap = points.ticksToCap;
        this.id = id;
        this.scoreMultiplier = this.id == 0 ? 2 : 1
        this.radius = this.scoreMultiplier == 1 ? points.pointRadius : points.bigPointRadius;
    }

    update(playersOnPoint) {
        //returns true only if point status changed
        let numCapturing = playersOnPoint.length;
        if (numCapturing == 0) return 0;
        let teamCode = playersOnPoint[0].teamCode;
        //only update point status if all players in the point are of the same team
        if (numCapturing == playersOnPoint.filter(p => p.teamCode == teamCode).length) {
            if (this.owner != teamCode) {
                if (this.capturer != teamCode) {
                    this.ticks -= numCapturing;
                    if (this.ticks <= 0) {
                        this.ticks = 0;
                        this.capturer = teamCode;
                        this.owner = 3;
                        this.ticks += numCapturing;
                        this.neutralizedThisTick = true;
                    }
                }
                else if (this.capturer == teamCode) {
                    this.ticks += numCapturing;
                    if (this.ticks >= this.ticksToCap) {
                        this.ticks = this.ticksToCap;
                        this.owner = teamCode;
                        this.capturedThisTick = true;
                    }
                }
            }
            else {
                if (this.ticks == this.ticksToCap) return false;
                this.ticks = Math.min(this.ticks + numCapturing, this.ticksToCap);
            }
            return true;
        }
        return false;
    }

    postTick() {
        this.capturedThisTick = false;
        this.neutralizedThisTick = false;
    }

    get percentCaptured() {
        return (this.ticks / this.ticksToCap) * 100;
    }

    static cappedByTeam(teamCode, points) {
        return points.filter(p => p.owner == teamCode && p.ticks == p.ticksToCap);
    }

    static percentByTeam(teamCode, points) {
        return points.reduce((a, p) => p.owner == teamCode ? a + 5 * p.scoreMultiplier : a, 0);
    }
}

module.exports = Point;