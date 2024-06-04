const Point = require('../classes/point');
const { worldValues: { points } } = require('../data/values.json');
const assert = require('assert');

describe('Testing the point class', function() {
    it('1. Update a point that is fully neutralized', function() {
        let point = new Point([0, 0], 0);
        point.update([{teamCode: 1}]);
        assert.equal(point.percentCaptured.toFixed(3), "0.333");
    });

    it('2. Update a neutralized point with 2 players at once', function() {
        let point = new Point([0, 0], 0);
        point.update([{teamCode: 1}, {teamCode: 1}]);
        assert.equal(point.percentCaptured.toFixed(3), "0.667");
    });

    it('3. Fully capture a point after the required number of ticks', function() {
        let point = new Point([0, 0], 0);
        for (var i = 0; i < points.ticksToCap; i++) {
            point.update([{teamCode: 1}]);
        }
        assert.equal(point.owner, 1);
    });
});