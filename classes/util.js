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

    static distance(p1, p2) {
        return Util.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    static hypot(x, y) {
        return Math.sqrt(x ** 2 + y ** 2);
    }

    static base(c, a) {
        return Math.sqrt(c ** 2 - a ** 2);
    }

    static circleLineSegmentIntersect(circle, lineSegment, radius) {
        //assume circle is at (0, 0) relative to linesegment
        let dx = lineSegment.p2.x - lineSegment.p1.x;
        let dy = lineSegment.p2.y - lineSegment.p1.y;
        let fx = lineSegment.p1.x - circle.x;
        let fy = lineSegment.p1.y - circle.y;

        let a = dx * dx + dy * dy;
        let b = 2 * (fx * dx + fy * dy);
        let c = fx * fx + fy * fy - radius * radius;
        
        //"b^2 - 4ac"
        let discriminant = b * b - 4 * a * c;
        //sqrt of negative doesn't exist, return early with no intersections
        if (discriminant < 0) return false;
        
        //solve the quadratic equation
        discriminant = Math.sqrt(discriminant);
        let t1 = (-b - discriminant) / (2 * a);
        let t2 = (-b + discriminant) / (2 * a);
        
        let intersections = 0;
        //check both of our solutions
        if (t1 >= 0 && t1 <= 1) intersections++;
        if (t2 >= 0 && t2 <= 1) intersections++;
        return intersections > 0;
    }
}

module.exports = Util;