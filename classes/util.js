class Util {
    static clamp(value, min, max) {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        } else return value;
    }

    static randRange(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    static toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    static angle(x, y) {
        return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
    }

    static hypot(x, y) {
        return Math.sqrt(x ** 2 + y ** 2);
    }

    static base(c, a) {
        return Math.sqrt(c ** 2 - a ** 2);
    }
}

module.exports = Util;