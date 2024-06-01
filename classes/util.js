class Util {
    static clamp(value, min, max) {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        } else return value;
    }

    static hypot(x, y) {
        return Math.sqrt(x ** 2 + y ** 2);
    }

    static base(c, a) {
        return Math.sqrt(c ** 2 - a ** 2);
    }
}

module.exports = Util;