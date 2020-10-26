/* global Phaser RemotePlayer io */

var game = new Phaser.Game(1000, 800, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render })

function preload () {
  game.load.image('earth', 'assets/default.png')
  game.load.image('playercar', 'assets/car.png')
  game.load.image('othercar', 'assets/car2.png')
  game.load.image('boundary', 'assets/boundary.png')
  game.load.image('grave', 'assets/grave.png')
  game.load.spritesheet('gremlin', 'assets/gremlins.png', 18, 24, 2);
}

var socket // Socket connection

var land

var player

var enemies

var gremlins

var currentSpeed = 0
var cursors

function create () {
  socket = io.connect()

  // Center the canvas
  game.scale.pageAlignHorizontally = true;
  game.scale.pageAlignVertically = true;

  game.world.setBounds(-500, -500, 1000, 1000)

  // Our tiled scrolling background
  land = game.add.tileSprite(0, 0, 1000, 1000, 'earth')
  land.fixedToCamera = true

  // The base of our player
  var startX = Math.round(Math.random() * (1000) - 500)
  var startY = Math.round(Math.random() * (1000) - 500)
  player = game.add.sprite(startX, startY, 'playercar')
  player.anchor.setTo(0.5, 0.5)
  //player.animations.add('move', [0, 1, 2, 3, 4, 5, 6, 7], 20, true)
  //player.animations.add('stop', [3], 20, true)

  // This will force it to decelerate and limit its speed
  // player.body.drag.setTo(200, 200)
  game.physics.enable(player, Phaser.Physics.ARCADE);
  player.body.maxVelocity.setTo(150, 150)
  player.body.collideWorldBounds = true
  player.body.immovable = true

  // Add boundaries to sides
  wallSprite = [];
  for (i = 0; i < 100; i++) {
    wallSprite.push(game.add.sprite(-400, -500 + i * 47, 'boundary'));
    game.physics.enable(wallSprite[wallSprite.length -1], Phaser.Physics.ARCADE);
  }
  for (i = 0; i < 100; i++) {
    wallSprite.push(game.add.sprite(400, -500 + i * 47, 'boundary'));
    game.physics.enable(wallSprite[wallSprite.length -1], Phaser.Physics.ARCADE);
  }
  for (var i = 0; i < wallSprite.length; i++) {
    game.physics.arcade.overlap(player, wallSprite[i]);
  }

  // Create some baddies to waste :)
  enemies = []
  gremlins = []

  for (var i = 0; i < 20; i++) {
    var eX = Math.round(Math.random() * (1000) - 500)
    var eY = Math.round(Math.random() * (1000) - 500)
    // parameters are x, y, width, height
    gremlins.push(game.add.sprite(eX, eY, 'gremlin'));
    game.physics.enable(gremlins[gremlins.length -1], Phaser.Physics.ARCADE);
    gremlins[gremlins.length -1].body.collideWorldBounds = true
    gremlins[gremlins.length -1].body.immovable = true
    gremlins[gremlins.length -1].animations.add('walk');
    gremlins[gremlins.length -1].animations.play('walk', 6, true);
  }

  player.bringToTop()

  game.camera.follow(player)
  game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300)
  game.camera.focusOnXY(0, 0)

  cursors = game.input.keyboard.createCursorKeys()
  game.time.events.loop(Phaser.Timer.SECOND * 2, moveEnemies, this);

  // Start listening for events
  setEventHandlers()
}

var setEventHandlers = function () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // New player message received
  socket.on('new player', onNewPlayer)

  // Player move message received
  socket.on('move player', onMovePlayer)

  // Player removed message received
  socket.on('remove player', onRemovePlayer)
}

// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')

  // Reset enemies on reconnect
  enemies.forEach(function (enemy) {
    enemy.player.kill()
  })
  enemies = []

  // Send local player data to the game server
  socket.emit('new player', { x: player.x, y: player.y, angle: player.angle })
}

// Socket disconnected
function onSocketDisconnect () {
  console.log('Disconnected from socket server')
}

// New player
function onNewPlayer (data) {
  console.log('New player connected:', data.id)

  // Avoid possible duplicate players
  var duplicate = playerById(data.id)
  if (duplicate) {
    console.log('Duplicate player!')
    return
  }

  // Add new player to the remote players array
  enemies.push(new RemotePlayer(data.id, game, player, data.x, data.y, data.angle))
}

// Move enemies
function moveEnemies () {
  console.log('Moving');
  gremlins.forEach((enemy) => {
    const randNumber = Math.floor((Math.random() * 4) + 1);

    switch(randNumber) {
      case 1:
        enemy.body.velocity.x = 50;
        break;
      case 2:
        enemy.body.velocity.x = -50;
        break;
      case 3:
        enemy.body.velocity.y = 50;
        break;
      case 4:
        enemy.body.velocity.y = -50;
        break;
      default:
        enemy.body.velocity.x = 50;
    }
  });
}

// Move player
function onMovePlayer (data) {
  var movePlayer = playerById(data.id)

  // Player not found
  if (!movePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  // Update player position
  movePlayer.player.x = data.x
  movePlayer.player.y = data.y
  movePlayer.player.angle = data.angle
}

// Remove player
function onRemovePlayer (data) {
  var removePlayer = playerById(data.id)

  // Player not found
  if (!removePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  removePlayer.player.kill()

  // Remove player from array
  enemies.splice(enemies.indexOf(removePlayer), 1)
}

function update () {
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].alive) {
      enemies[i].update()
      game.physics.arcade.collide(player, enemies[i].player)
    }
  }

  if (cursors.left.isDown) {
    player.angle -= 4
  } else if (cursors.right.isDown) {
    player.angle += 4
  }

  if (cursors.up.isDown) {
    // The speed we'll travel at
    currentSpeed = 300
  } else {
    if (currentSpeed > 0) {
      currentSpeed -= 4
    }
  }

  game.physics.arcade.velocityFromRotation(player.rotation, currentSpeed, player.body.velocity)

  if (currentSpeed > 0) {
    player.animations.play('move')
  } else {
    player.animations.play('stop')
  }

  land.tilePosition.x = -game.camera.x
  land.tilePosition.y = -game.camera.y

  if (game.input.activePointer.isDown) {
    if (game.physics.arcade.distanceToPointer(player) >= 10) {
      currentSpeed = 300

      player.rotation = game.physics.arcade.angleToPointer(player)
    }
  }

  socket.emit('move player', { x: player.x, y: player.y, angle: player.angle })
}

function render () {

}

// Find player by ID
function playerById (id) {
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].player.name === id) {
      return enemies[i]
    }
  }

  return false
}
