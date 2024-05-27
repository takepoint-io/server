require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');
const World = require('./classes/world');
const enums = require('./data/enums.json');
const { worldValues, serverValues } = require("./data/values.json");
const serverConfig = require("./config.json");

const APIUrl = serverConfig.dev ? "http://127.0.0.1:8080" : "https://takepoint.io";

const serverStats = {
    lastWarning: 0,
    lastAPIUpdate: 0,
    id: Math.floor(Math.random() * 9000) + 1000
};
const world = new World(worldValues.radius, worldValues.points);

function nextTick() {


    if (Date.now() - serverStats.lastAPIUpdate > serverConfig.APIUpdateFreq) {
        axios.post(`${APIUrl}/register_instance`, {
            auth: {
                id: serverStats.id,
                registerKey: process.env.registerKey
            },
            data: {
                region: serverConfig.region,
                city: serverConfig.city,
                game_type: serverConfig.game_type,
                owner: serverConfig.owner,
                label: serverConfig.label,
                url: serverConfig.url,
                players: 0,
                capacity: serverConfig.capacity,
                short_id: serverConfig.short_id
            }
        })
        .catch(error => {});
    }
}

let lastTick = Date.now();
const gameLoop = function() {
    let now = Date.now();
    if (lastTick + serverValues.tickLength <= now) {
        const delta = now - lastTick;
        console.log(delta)
        if (delta >= serverValues.tickLength * 1.1 && now - serverStats.lastWarning > 60 * 1000) {
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