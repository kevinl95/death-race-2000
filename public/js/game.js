/* global Phaser RemotePlayer io */

var game = new Phaser.Game(1000, 800, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render })

//  The Google WebFont Loader will look for this object, so create it before loading the script.
WebFontConfig = {

    //  'active' means all requested fonts have finished loading
    //  We set a 1 second delay before calling 'createText'.
    //  For some reason if we don't the browser cannot render the text the first time it's created.
    active: function() { game.time.events.add(Phaser.Timer.SECOND, createText, this); },

    //  The Google Fonts we want to load (specify as many as you like in the array)
    google: {
      families: ['Press Start 2P']
    }

};

function preload () {
  //  Load the Google WebFont Loader script
  game.load.script('webfont', '//ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont.js');
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

var wallSprite

var enemies

var graves

var gremlins

var currentSpeed = 0
var cursors

var countdown

function create () {
  socket = io.connect()

  game.initialTime = 90;

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

  // This will force it to decelerate and limit its speed
  game.physics.enable(player, Phaser.Physics.ARCADE);
  player.body.maxVelocity.setTo(75, 75)
  player.body.collideWorldBounds = true
  player.stopVelocityOnCollide = true;

  // Add boundaries to sides
  createWalls();

  // Create some baddies to waste :)
  createEnemies();

  player.bringToTop()

  game.camera.follow(player)
  game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300)
  game.camera.focusOnXY(0, 0)

  cursors = game.input.keyboard.createCursorKeys()
  game.time.events.loop(Phaser.Timer.SECOND * 2, moveEnemies, this);

  // Start listening for events
  setEventHandlers()
}

function createWalls() {
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
    wallSprite[i].body.immovable = true;
    wallSprite[i].body.moves = false;
    game.physics.arcade.overlap(player, wallSprite[i]);
  }
}

function createGremlin() {
  var eX = Math.round(Math.random() * (1000) - 300)
  var eY = Math.round(Math.random() * (1000) - 300)
  // parameters are x, y, width, height
  gremlins.push(game.add.sprite(eX, eY, 'gremlin'));
  game.physics.enable(gremlins[gremlins.length -1], Phaser.Physics.ARCADE);
  gremlins[gremlins.length -1].body.collideWorldBounds = true
  gremlins[gremlins.length -1].animations.add('walk');
  gremlins[gremlins.length -1].animations.play('walk', 6, true);
}

function createEnemies() {
  enemies = []
  graves = []
  gremlins = []

  for (var i = 0; i < 20; i++) {
    createGremlin();
  }
}

function createText() {

    countdown = game.add.text(game.camera.x, game.camera.y, 'Time: ' + formatTime(game.initialTime));
    countdown.anchor.setTo(0.5);
    countdown.font = 'Press Start 2P';
    countdown.fontSize = 24;

    countdown.align = 'center';
    countdown.stroke = '#ffffff';
    countdown.fill = '#ffffff';
    countdown.strokeThickness = 2;

    // Each 1000 ms call onEvent
    timedEvent = game.time.events.loop(Phaser.Timer.SECOND * 1, onCount, game);

}

function formatTime(seconds){
    // Minutes
    var minutes = Math.floor(seconds/60);
    // Seconds
    var partInSeconds = seconds%60;
    // Adds left zeros to seconds
    partInSeconds = partInSeconds.toString().padStart(2,'0');
    // Returns formated time
    return `${minutes}:${partInSeconds}`;
}


function onCount ()
{
    if (game.initialTime == 0) {
      gremlins.forEach((enemy) => {
        enemy.destroy();
      });
      graves.forEach((grave) => {
        grave.destroy();
      });
      createEnemies();
      game.initialTime = 91;
    }
    game.initialTime -= 1; // One second
    countdown.setText('Time: ' + formatTime(game.initialTime));
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

  // Gremlin move message received
  socket.on('move gremlin', onMoveGremlin)

  // Player removed message received
  socket.on('remove player', onRemovePlayer)
}

// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')

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

// Gremlin has moved
function onMoveGremlin (data) {
  // Find Gremlin in array
  var moveGremlin = findGremlin(data)
  console.log('MOVING GREM')
  // Gremlin not found
  if (!moveGremlin) {
    console.log('Gremlin not found: ' + data)
    return
  }

  // Update Gremlin position
  moveGremlin.setX(data.x)
  moveGremlin.setY(data.y)
  moveGremlin.setAngle(data.angle)
}

function collidePlayerVsGremlin(_player, _gremlin) {
    _gremlin.kill();
    graves.push(game.add.sprite(_gremlin.world.x, _gremlin.world.y, 'grave'));
    game.physics.enable(graves[graves.length -1], Phaser.Physics.ARCADE);
    graves[graves.length -1].body.collideWorldBounds = true
    graves[graves.length -1].body.immovable = true;
    graves[graves.length -1].body.moves = false;
    createGremlin();
  }

function update () {

  for (var i = 0; i < wallSprite.length; i++) {
    wallSprite[i].update()
    game.physics.arcade.collide(player, wallSprite[i])
  }
  for (var i = 0; i < graves.length; i++) {
    graves[i].update()
    game.physics.arcade.collide(player, graves[i])
  }
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].alive) {
      enemies[i].update()
      game.physics.arcade.collide(player, enemies[i].player)
    }
  }

  for (var i = 0; i < gremlins.length; i++) {
    game.physics.arcade.collide(player, gremlins[i], collidePlayerVsGremlin)
    socket.emit('move gremlin', { x: gremlins[i].x, y: gremlins[i].y, angle: gremlins[i].angle })
    gremlins[i].update()
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



// Find Gremlin by ID
function findGremlin (gremlin) {
  var i
  for (i = 0; i < gremlins.length; i++) {
    if (gremlin == gremlins[i]) {
      return gremlins[i]
    }
  }

  return false
}
