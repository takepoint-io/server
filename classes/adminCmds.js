const Util = require('./util');
const Packet = require('./packet');
const commands = new Map();
let commandsArr = [
    {
        name: "broadcast",
        exec: (args, _player, world) => {
            for (let [_targetID, target] of world.players) {
                target.packet.serverMessage(Packet.createServerMessage("misc", args.join(" ")));
            }
        }
    },
    {
        name: "tp",
        exec: (args, player, world) => {
            let target = world.getPlayerByName(args[0]);
            if (!target) return;
            let distToCenter = Util.hypot(target.x, target.y);
            let newMagnitude = (distToCenter - target.radius * 2.1) / distToCenter;
            player.x = target.x * newMagnitude;
            player.y = target.y * newMagnitude;
        }
    },
    {
        name: "kill",
        exec: (args, player, world) => {
            let target = world.getPlayerByName(args[0]);
            if (!target) returnl
            let res = target.takeDamage(300, player, false);
            if (res) world.onPlayerDeath(target, player);
        }
    },
    {
        name: "givescore",
        exec: (args, _player, world) => {
            let target = world.getPlayerByName(args[0]);
            if (!target) return;
            target.addScore(+args[1] || 0);
        }
    },
    {
        name: "heal",
        exec: (args, _player, world) => {
            let target = world.getPlayerByName(args[0]);
            if (!target) return;
            target.health = Util.clamp(target.health + (+args[1] || target.maxHealth), 0, target.maxHealth);
            target.miscUpdates.set("hp", target.health);
        }
    },
    {
        name: "kick",
        exec: (args, _player, world) => {
            let target = world.getPlayerByName(args[0]);
            if (!target) return;
            target.socket.kick();
        }
    },
    {
        name: "restart",
        exec: (_args, _player, world) => {
            for (let [_targetID, target] of world.players) {
                target.socket.kick();
            }
            world.initWorld();
        }
    }
];

commandsArr.forEach(cmd => {
    commands.set(cmd.name, cmd);
});

module.exports = { commands, commandsArr };