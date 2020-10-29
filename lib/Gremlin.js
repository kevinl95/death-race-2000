/* ************************************************
** GAME GREMLIN CLASS
************************************************ */
var Gremlin = function (startX, startY, startAngle) {
  var x = startX
  var y = startY
  var angle = 0
  var id

  // Getters and setters
  var getX = function () {
    return x
  }

  var getY = function () {
    return y
  }

  var getAngle = function () {
    return 0
  }

  var setX = function (newX) {
    x = newX
  }

  var setY = function (newY) {
    y = newY
  }

  var setAngle = function (newAngle) {
    angle = 0
  }

  // Define which variables and methods can be accessed
  return {
    getX: getX,
    getY: getY,
    getAngle: getAngle,
    setX: setX,
    setY: setY,
    setAngle: setAngle,
    id: id
  }
}

// Export the Gremlin class so you can use it in
// other files by using require("Gremlin")
module.exports = Gremlin
