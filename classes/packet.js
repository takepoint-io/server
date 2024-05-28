const { serverPackets, clientPackets } = require('../data/enums.json');

class Packet {
    constructor(data = {}) {
        this.data = data;
    }

    pointInfo(pointArray) {
        
    }

    encode() {
        let packet = this.data;
        if (packet.type == "ping") return serverPackets.ping;
        if (packet.type == "state") {
            return "";
        }
        throw new Error("Packet type not recognized! Must be either ping or state");
    }

    enc() {
        return Packet.toBytes(this.encode());
    }

    static toBytes(packet) {
        return new TextEncoder().encode(packet);
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