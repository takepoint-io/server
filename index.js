const WebSocket = require('ws');
const World = require('./classes/world');
const enums = require('./data/enums.json');
const { worldValues, serverValues } = require("./data/values.json");

const serverHealth = {
    lastWarning: 0
};
const world = new World(worldValues.radius, worldValues.points);

function nextTick() {

}

let lastTick = Date.now();
const gameLoop = function() {
    let now = Date.now();
    if (lastTick + serverValues.tickLength <= now) {
        const delta = now - lastTick;
        console.log(delta)
        if (delta >= serverValues.tickLength * 1.1 && now - serverHealth.lastWarning > 60 * 1000) {
            console.log(`Ticks are taking more than 10% longer than expected! Last tick took ${delta}ms`);
            serverValues.lastWarning = Date.now();
        }
        lastTick = now;
        nextTick();
    }
    if (Date.now() - lastTick < 20) {
        setTimeout(gameLoop)
    } else {
        setImmediate(gameLoop)
    }
}

gameLoop();