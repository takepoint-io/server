const { serverPackets, clientPackets } = require('../data/enums.json');

class Packet {
    constructor(data = { type: "state", packetList: [] }) {
        this.data = data;
    }

    pointInfo(point) {
        let packet = [
            serverPackets.pointInfo,
            point.id,
            point.owner,
            point.x,
            point.y,
            point.radius,
            point.percentCaptured,
            point.capturer,
            1
        ].join(",");
        this.data.packetList.push(packet);
    }

    pointUpdate(point) {
        let packet = [
            serverPackets.pointUpdate,
            point.id,
            point.percentCaptured.toFixed(2),
            point.capturedThisTick ? point.owner : ""
        ].join(",");
        this.data.packetList.push(packet);
    }

    viewbox(player) {
        let packet = [
            serverPackets.viewbox,
            player.id,
            player.viewbox.x,
            player.viewbox.y
        ].join(",");
        this.data.packetList.push(packet);
    }

    spawn(player) {
        let packet = [
            serverPackets.joinGame,
            player.id,
            player.teamCode,
            player.weapon.id,
            player.x,
            player.y,
            player.radius,
            player.angle,
            player.health,
            player.maxHealth,
            player.score,
            player.level,
            player.weapon.ammo,
            player.weapon.maxAmmo,
            0,
            player.viewbox.x,
            player.viewbox.y,
            "test1",
            player.spawnProt,
            player.shield,
            player.maxShield
        ].join(",");
        this.data.packetList.push(packet);
    }

    playerUpdate(player) {
        let packet = [
            serverPackets.playerUpdate,
            player.id,
            player.x,
            player.y,
            Math.round(player.spdX),
            Math.round(player.spdY),
            player.angle
        ].join(",");
        this.data.packetList.push(packet);
    }

    playerMiscData(player) {
        let fields = player.updatedFields;
        let packet = [
            serverPackets.playerMiscData,
            player.id,
            fields.get("firing") ?? "",
            fields.get("reloading") ?? "",
            fields.get("beingHit") ?? "",
            fields.get("hp") ?? "",
            fields.get("spawnProt") ?? "",
            fields.get("radius") ?? "",
            "",
            fields.get("weapon") ?? "",
            fields.get("username") ?? "",
            fields.get("armor") ?? "",
            fields.get("chat") ?? ""
        ].join(",");
        this.data.packetList.push(packet);
    }

    encode() {
        let packet = this.data;
        if (packet.type == "ping") return serverPackets.ping;
        if (packet.type == "state") {
            return packet.packetList.join("|");
        }
        throw new Error("Packet type not recognized! Must be either ping or state");
    }

    enc() {
        return Packet.toBytes(this.encode());
    }

    static toBytes(packet) {
        return Buffer.from(packet);
    }

    static decode(packet) {
        let utf8 = new TextDecoder().decode(packet);
        utf8 = utf8.replace("\x00", "");
        let parts = utf8.split(",");
        let opcode = parts[0];
        let data = {};
        switch (opcode) {
            case clientPackets.ping:
                data.type = "ping";
                break;

            case clientPackets.chat:
                data.type = "chat";
                data.message = parts[1];
                break;

            case clientPackets.reset:
                data.type = "reset";
                break;

            case clientPackets.keypress:
                data.type = "keypress";
                data.key = parseInt(parts[1]);
                data.pressed = parseInt(parts[2]);
                break;

            case clientPackets.mouse:
                data.type = "mouse";
                data.x = parseInt(parts[1]);
                data.y = parseInt(parts[2]);
                data.angle = parseInt(parts[3]);
                break;

            case clientPackets.debug:
                data.type = "debug";
                data.value = parts[1];
                break;
            
            case clientPackets.userAgent:
                data.type = "userAgent";
                data.value = parts[1];
                break;

            case clientPackets.spawn:
                data.type = "spawn";
                break;

            case clientPackets.gun:
                data.type = "gun";
                data.gun = parseInt(parts[1]);
                break;
            
            case clientPackets.adBlock:
                data.type = "adBlock",
                data.enabled = parseInt(parts[1]);
                break;

            default:
                data.type = "unknown";
        }
        return data;
    }
}

module.exports = Packet;