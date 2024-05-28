class Team {
    constructor(name, id) {
        this.name = name;
        this.id = id;
        this.players = new Map();
    }

    addPlayer(player) {
        this.players.set(player.id, player);
    }

    removePlayer(player) {
        this.players.delete(player.id);
    }
}

module.exports = Team;