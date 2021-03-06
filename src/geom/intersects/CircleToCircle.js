var DistanceBetween = require('../../math/distance/DistanceBetween');

/**
 * [description]
 *
 * @function Phaser.Geom.Intersects.CircleToCircle
 * @since 3.0.0
 *
 * @param {Phaser.Geom.Circle} circleA - [description]
 * @param {Phaser.Geom.Circle} circleB - [description]
 *
 * @return {boolean} [description]
 */
var CircleToCircle = function (circleA, circleB)
{
    return (DistanceBetween(circleA.x, circleA.y, circleB.x, circleB.y) <= (circleA.radius + circleB.radius));
};

module.exports = CircleToCircle;
