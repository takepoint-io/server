require('dotenv').config();
const axios = require('axios');
const GameServer = require('./classes/gameServer');
const World = require('./classes/world');
const Packet = require('./classes/packet');
const { serverValues } = require('./data/values.json');
const serverConfig = require('./config.json');
const APIUrl = process.env.APIUrl || 'http://127.0.0.1:8080';
const serverPort = serverConfig.port || 8000;

const gameServer = new GameServer(serverPort, serverConfig);
const world = new World(gameServer.players, serverConfig, postRequest);

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
    id: Math.floor(Math.random() * 9000) + 1000,
    consecutiveFails: 0
};

function postRequest(endpoint, data) {
    return axios.post(`${APIUrl}${endpoint}`, {
        auth: {
            id: serverStats.id,
            registerKey: process.env.registerKey
        },
        data: data
    });
}

function nextTick() {
    try {
        world.evalTick();
        serverStats.consecutiveFails = 0;
    } catch (e) {
        console.log(e);
        serverStats.consecutiveFails++;
        if (serverStats.consecutiveFails > 10) {
            process.exit(0);
        }
    }

    if (Date.now() - serverStats.lastAPIUpdate > serverConfig.updateTimer) {
        axios.post(`${APIUrl}/register_instance`, {
            auth: {
                id: serverStats.id,
                registerKey: process.env.registerKey
            },
            data: {
                region: serverConfig.region,
                city: serverConfig.city,
                url: serverConfig.url || "localhost:" + serverPort,
                players: world.players.size,
                capacity: serverConfig.capacity
            },
            override: serverConfig.override
        }).catch(error => {});

        let playerUsernames = [];
        for (let [_playerID, player] of gameServer.players) {
            if (player.loggedIn) playerUsernames.push(player.username);
        }
        axios.post(`${APIUrl}/auth/updateSessions`, {
            auth: {
                id: serverStats.id,
                registerKey: process.env.registerKey
            },
            data: {
                sessions: JSON.stringify(playerUsernames)
            }
        }).catch(error => {});
        serverStats.lastAPIUpdate = Date.now();
    }
}

let lastTick = Date.now();
const gameLoop = function() {
    let now = Date.now();
    if (lastTick + serverValues.tickLength <= now) {
        const delta = now - lastTick;
        if (delta >= serverValues.tickLength * 1.1 && now - serverStats.lastWarning > 15 * 1000) {
            console.log(`Ticks are taking more than 10% longer than expected! Last tick took ${delta}ms`);
            serverStats.lastWarning = Date.now();
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