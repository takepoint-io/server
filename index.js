require('dotenv').config();
const axios = require('axios');
const GameServer = require('./classes/gameServer');
const World = require('./classes/world');
const Packet = require('./classes/packet');
const { serverValues } = require('./data/values.json');
const serverConfig = require('./config.json');
const APIUrl = serverConfig.dev ? 'http://127.0.0.1:8080' : 'https://takepoint.io';

const gameServer = new GameServer(8000, serverConfig.capacity);
const world = new World(gameServer.players);

gameServer.on("playerJoin", player => {
    world.handlePlayerJoin(player);
});

gameServer.on("playerMessage", (player, msg) => {
    let data;
    try {
        data = Packet.decode(msg);
    } catch (e) { return };
    if (data.type == "ping") {
        let ping = new Packet({ type: "ping" }).enc();
        player.sendUpdate(ping);
        player.socket.lastPing = Date.now();
        return;
    }
    world.handleMessage(player, data);
});

gameServer.on("playerLeave", player => {
    world.handlePlayerLeave(player);
})

const serverStats = {
    lastWarning: 0,
    lastAPIUpdate: 0,
    id: Math.floor(Math.random() * 9000) + 1000
};

function nextTick() {
    world.evalTick();

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
        if (delta >= serverValues.tickLength * 1.1 && now - serverStats.lastWarning > 15 * 1000) {
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