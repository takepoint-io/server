class Packet {
    constructor(data = {}) {
        this.data = data;
    }

    encode() {
        let packet = this.data;
        if (packet.type == "ping") return "."
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
}

module.exports = Packet;