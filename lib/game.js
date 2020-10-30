var util = require('util')
var http = require('http')
var path = require('path')
var ecstatic = require('ecstatic')
var io = require('socket.io')

var Player = require('./Player')
var Gremlin = require('./Gremlin')
var Grave = require('./Grave')

var port = process.env.PORT || 8080

/* ************************************************
** GAME VARIABLES
************************************************ */
var socket	// Socket controller
var players	// Array of connected players
var gremlins
var graves

/* ************************************************
** GAME INITIALISATION
************************************************ */

// Create and start the http server
var server = http.createServer(
  ecstatic({ root: path.resolve(__dirname, '../public') })
).listen(port, function (err) {
  if (err) {
    throw err
  }

  init()
})

function init () {
  // Create an empty array to store players
  players = []
  gremlins = []
  graves = []
  time = 90
  bestscore = 0

  // Attach Socket.IO to server
  socket = io.listen(server)

  // Start listening for events
  setEventHandlers()
}

/* ************************************************
** GAME EVENT HANDLERS
************************************************ */
var setEventHandlers = function () {
  // Socket.IO
  socket.sockets.on('connection', onSocketConnection)
}

// New socket connection
function onSocketConnection (client) {
  util.log('New player has connected: ' + client.id)

  // Listen for client disconnected
  client.on('disconnect', onClientDisconnect)

  // Listen for new player message
  client.on('new player', onNewPlayer)

  // Listen for move player message
  client.on('move player', onMovePlayer)

  // Listen for move gremlin message
  client.on('move gremlin', onMoveGremlin)

  // Listen for new gremlin message
  client.on('new gremlin', onNewGremlin)

  // Listen for move grave message
  client.on('move grave', onMoveGrave)

  // Listen for new grave message
  client.on('new grave', onNewGrave)

  // Update score
  client.on('update score', updateScore)

  // Update time
  client.on('update time', updateTime)
}

// Socket client has disconnected
function onClientDisconnect () {
  util.log('Player has disconnected: ' + this.id)

  var removePlayer = playerById(this.id)

  // Player not found
  if (!removePlayer) {
    util.log('Player not found: ' + this.id)
    return
  }

  // Remove player from players array
  players.splice(players.indexOf(removePlayer), 1)

  // Broadcast removed player to connected socket clients
  this.broadcast.emit('remove player', {id: this.id})
}

// Remove gremlin
function onRemoveGremlin (data) {
  var removeGremlin = findGremlin(data.id)
  this.broadcast.emit('remove gremlin', {id: removeGremlin.id})
  // Gremlin not found
  if (!removeGremlin) {
    return
  }

  removeGremlin.player.kill()

  // Remove gremlin from array
  gremlins.splice(gremlins.indexOf(removeGremlin), 1)
}

// Remove grave
function onRemoveGrave (data) {
  var removeGrave = findGrave(data.id)
  this.broadcast.emit('remove grave', {id: removeGrave.id})
  // Grave not found
  if (!removeGremlin) {
    return
  }

  removeGrave.player.kill()

  // Remove grave from array
  graves.splice(graves.indexOf(removeGrave), 1)
}

// New player has joined
function onNewPlayer (data) {
  // Create a new player
  var newPlayer = new Player(data.x, data.y, data.angle)
  newPlayer.id = this.id

  // Broadcast new player to connected socket clients
  this.broadcast.emit('new player', {id: newPlayer.id, x: newPlayer.getX(), y: newPlayer.getY(), angle: newPlayer.getAngle()})

  // Send existing players to the new player
  var i, existingPlayer
  for (i = 0; i < players.length; i++) {
    existingPlayer = players[i]
    this.emit('new player', {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY(), angle: existingPlayer.getAngle()})
  }

  // Send existing gremlins to new player
  var i, existingGremlin
  for (i = 0; i < gremlins.length; i++) {
    existingGremlin = gremlins[i]
    this.emit('new gremlin', {id: existingGremlin.id, x: existingGremlin.getX(), y: existingGremlin.getY(), angle: existingGremlin.getAngle()})
  }

  // Send existing graves to new player
  var i, existingGrave
  for (i = 0; i < graves.length; i++) {
    existingGrave = graves[i]
    this.emit('new grave', {id: existingGrave.id, x: existingGrave.getX(), y: existingGrave.getY(), angle: existingGrave.getAngle()})
  }

  // Send existing time and score to new player
  this.emit('update time',  { time: time })
  this.emit('update score',  { score: bestscore })

  // Add new player to the players array
  players.push(newPlayer)
}

// New gremlin has been added
function onNewGremlin (data) {
  // Create a new gremlin

  var newGremlin = new Gremlin(data.x, data.y, 0)
  newGremlin.id = data.id
  // Broadcast new gremlin to connected socket clients
  this.broadcast.emit('new gremlin', {id: newGremlin.id, x: newGremlin.getX(), y: newGremlin.getY(), angle: 0})

  // Add new gremlin to the gremlins array
  gremlins.push(newGremlin)
}

// New grave has been added
function onNewGrave (data) {
  // Create a new grave
  var newGrave = new Grave(data.x, data.y, data.angle)
  newGrave.id = data.id

  // Broadcast new gremlin to connected socket clients
  this.broadcast.emit('new grave', {id: newGrave.id, x: newGrave.getX(), y: newGrave.getY(), angle: 0})

  // Add new gremlin to the gremlins array
  graves.push(newGrave)
}

// Player has moved
function onMovePlayer (data) {
  // Find player in array
  var movePlayer = playerById(this.id)

  // Player not found
  if (!movePlayer) {
    util.log('Player not found: ' + this.id)
    return
  }

  // Update player position
  movePlayer.setX(data.x)
  movePlayer.setY(data.y)
  movePlayer.setAngle(data.angle)

  // Broadcast updated position to connected socket clients
  this.broadcast.emit('move player', {id: movePlayer.id, x: movePlayer.getX(), y: movePlayer.getY(), angle: movePlayer.getAngle()})
}

// Gremlin has moved
function onMoveGremlin (data) {
  // Find Gremlin in array
  var moveGremlin = findGremlin(data.id)
  // Gremlin not found
  if (!moveGremlin) {
    return
  }

  // Update Gremlin position
  moveGremlin.setX(data.x)
  moveGremlin.setY(data.y)
  moveGremlin.setAngle(data.angle)

  // Broadcast updated position to connected socket clients
  this.broadcast.emit('move gremlin', {id: moveGremlin.id, x: moveGremlin.x, y: moveGremlin.y, angle: moveGremlin.angle})
}

// Grave has moved
function onMoveGrave (data) {
  // Find Grave in array
  var moveGrave = findGrave(data.id)
  // Gremlin not found
  if (!moveGrave) {
    return
  }

  // Update Grave position
  moveGrave.setX(data.x)
  moveGrave.setY(data.y)
  moveGrave.setAngle(data.angle)

  // Broadcast updated position to connected socket clients
  this.broadcast.emit('move grave', {id: moveGrave.id, x: moveGrave.x, y: moveGrave.y, angle: moveGrave.angle})
}

// Update time
function updateTime (data) {
  if (data.time < time) {
    time = data.time;
    this.broadcast.emit('update time',  { time: time })
  }
  if (time == 0) {
    time = 90
    this.broadcast.emit('update time',  { time: time })
    gremlins = []
    graves = []
    bestscore = 0
    this.broadcast.emit('update score',  { score: bestscore })
  }
}

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function createGremlin() {
  var eX = Math.round(Math.random() * (1000) - 500)
  var eY = Math.round(Math.random() * (1000) - 500)
  this.broadcast.emit('new gremlin', {id: uuidv4(), x: eX, y: eY, angle: 0 })
}

function createEnemies() {
  graves = []
  gremlins = []

  for (var i = 0; i < 20; i++) {
    createGremlin();
  }
}

// Update score
function updateScore (data) {
  if (data.score > bestscore) {
    bestscore = data.score;
    this.broadcast.emit('update score',  { score: bestscore })
  }
}

/* ************************************************
** GAME HELPER FUNCTIONS
************************************************ */
// Find player by ID
function playerById (id) {
  var i
  for (i = 0; i < players.length; i++) {
    if (players[i].id === id) {
      return players[i]
    }
  }

  return false
}

// Find Gremlin by ID
function findGremlin (id) {
  for (var i = 0; i < gremlins.length; i++) {
    if (gremlins[i].id == id) {
      return gremlins[i]
    }
  }

  return false
}

// Find Grave by ID
function findGrave (id) {
  for (var i = 0; i < graves.length; i++) {
    if ( graves[i].id == id) {
      return graves[i]
    }
  }

  return false
}
