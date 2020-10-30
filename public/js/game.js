/* global Phaser RemotePlayer RemoteGrave RemoteGremlin io */

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
  game.load.audio('scream', 'assets/gremlin.mp3');
  game.load.audio('background', 'assets/engine.mp3');
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

var enemies = []

var graves = []

var gremlins = []

var scream
var background

var currentSpeed = 0
var cursors

var countdown
var playerscore
var scoreval = 0
var winningscore
var winningval = 0

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
  var startX = Math.round(Math.random() * (1000) - 700)
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

  player.bringToTop()

  game.camera.follow(player)
  game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300)
  game.camera.focusOnXY(0, 0)

  cursors = game.input.keyboard.createCursorKeys()
  game.time.events.loop(Phaser.Timer.SECOND * 2, moveEnemies, this);

  // Audio
  scream = game.add.audio('scream');
  background = game.add.audio('background');

  // Start listening for events
  setEventHandlers()
  //  Being mp3 files these take time to decode, so we can't play them instantly
      //  Using setDecodedCallback we can be notified when they're ALL ready for use.
      //  The audio files could decode in ANY order, we can never be sure which it'll be.

  game.sound.setDecodedCallback([scream, background], start, this);

}

function start() {
    background.loopFull(0.7);
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

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function createGremlin() {
  var eX = Math.round(Math.random() * (1000) - 500)
  var eY = Math.round(Math.random() * (1000) - 500)
  // Send local gremlin data to the game server
  socket.emit('new gremlin', {id: uuidv4(), x: eX, y: eY, angle: 0 })
}

function createGrave(posx, posy) {
  // Send local grave data to the game server
  var name = uuidv4()
  graves.push(new RemoteGrave(name, game, player, posx, posy, 0))
  socket.emit('new grave', {id: name, x: posx, y: posy, angle: 0 })
}

function createText() {

    countdown = game.add.text(500, 50, formatTime(game.initialTime));
    countdown.anchor.setTo(0.5);
    countdown.font = 'Press Start 2P';
    countdown.fontSize = 24;
    countdown.fixedToCamera = true;
    countdown.align = 'center';
    countdown.stroke = '#ffffff';
    countdown.fill = '#ffffff';
    countdown.strokeThickness = 1;

    playerscore = game.add.text(250, 50, "Points: 0");
    playerscore.anchor.setTo(0.5);
    playerscore.font = 'Press Start 2P';
    playerscore.fontSize = 24;
    playerscore.fixedToCamera = true;
    playerscore.align = 'center';
    playerscore.stroke = '#ffffff';
    playerscore.fill = '#ffffff';
    playerscore.strokeThickness = 1;

    winningscore = game.add.text(750, 50, "Top Score: 0");
    winningscore.anchor.setTo(0.5);
    winningscore.font = 'Press Start 2P';
    winningscore.fontSize = 24;
    winningscore.fixedToCamera = true;
    winningscore.align = 'center';
    winningscore.stroke = '#ffffff';
    winningscore.fill = '#ffffff';
    winningscore.strokeThickness = 1;

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
        enemy.player.destroy()
        socket.emit('remove gremlin', {id: enemy.id})
      });
      graves.forEach((grave) => {
        grave.player.destroy()
        socket.emit('remove grave', {id: grave.id})
      });
      scoreval = 0;
      winningval = 0;
      game.initialTime = 91;
      socket.emit('update time', { time: game.initialTime })
    }
    game.initialTime -= 1; // One second
    socket.emit('update time', { time: game.initialTime })
    countdown.setText(formatTime(game.initialTime));
    playerscore.setText("Points: " + scoreval.toString());
    winningscore.setText("Top Score: " + winningval.toString());
}

var setEventHandlers = function () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // New player message received
  socket.on('new player', onNewPlayer)

  // Listen for new gremlin message
  socket.on('new gremlin', onNewGremlin)

  // Listen for new grave message
  socket.on('new grave', onNewGrave)

  // Player move message received
  socket.on('move player', onMovePlayer)

  // Gremlin move message received
  socket.on('move gremlin', onMoveGremlin)

  // Grave move message received
  socket.on('move grave', onMoveGrave)

  // Update score
  socket.on('update score', updateScore)

  // Update time
  socket.on('update time', updateTime)

  // Player removed message received
  socket.on('remove player', onRemovePlayer)

  // Player removed message received
  socket.on('remove gremlin', onRemoveGremlin)

  // Player removed message received
  socket.on('remove grave', onRemoveGrave)
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

// New gremlin has been added
function onNewGremlin (data) {
  // Avoid possible duplicate gremlins
  var duplicate = findGremlin(data.id)
  if (duplicate) {
    return
  }
  // Add new gremlin to the gremlins array
  gremlins.push(new RemoteGremlin(data.id, game, player, data.x, data.y, 0))
}

// New grave has been added
function onNewGrave (data) {
  // Avoid possible duplicate graves
  var duplicate = findGrave(data.id)
  if (duplicate) {
    return
  }
  // Add new grave to the gremlins array
  graves.push(new RemoteGrave(data.id, game, player, data.x, data.y, 0))
}

// Move enemies
function moveEnemies () {
  gremlins.forEach((enemy) => {
    if (enemy.player.body !== null) {
      const randNumber = Math.floor((Math.random() * 4) + 1);
      switch(randNumber) {
        case 1:
          enemy.player.body.velocity.x = 50;
          break;
        case 2:
          enemy.player.body.velocity.x = -50;
          break;
        case 3:
          enemy.player.body.velocity.y = 50;
          break;
        case 4:
          enemy.player.body.velocity.y = -50;
          break;
        default:
          enemy.player.body.velocity.x = 50;
      }
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

// Update time
function updateTime (data) {
  if (data.time < game.initialTime) {
    game.initialTime = data.time;
  }
}

// Update score
function updateScore (data) {
  if (data.score > winningval) {
    winningval = data.score;
  }
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

// Remove gremlin
function onRemoveGremlin (data) {
  var removeGremlin = findGremlin(data.id)
  console.log('Removing gremlin')
  // Gremlin not found
  if (!removeGremlin) {
    console.log('Gremlin not found: ', data.id)
    return
  }

  removeGremlin.player.kill()

  // Remove gremlin from array
  gremlins.splice(gremlins.indexOf(removeGremlin), 1)
}

// Remove grave
function onRemoveGrave (data) {
  var removeGrave = findGrave(data.id)

  // Grave not found
  if (!removeGremlin) {
    console.log('Grave not found: ', data.id)
    return
  }

  removeGrave.player.kill()

  // Remove grave from array
  graves.splice(graves.indexOf(removeGrave), 1)
}

// Gremlin has moved
function onMoveGremlin (data) {
  // Find Gremlin in array
  var moveGremlin = findGremlin(data.id)
  // Gremlin not found
  if (!moveGremlin) {
    console.log('Gremlin not found: ' + data)
    return
  }

  // Update Gremlin position
  moveGremlin.player.x = data.x
  moveGremlin.player.y = data.y
  moveGremlin.player.angle = data.angle
}

// Grave has moved
function onMoveGrave (data) {
  // Find Grave in array
  var moveGrave = findGrave(data.id)
  // Gremlin not found
  if (!moveGrave) {
    console.log('Grave not found: ' + data)
    return
  }

  // Update Grave position
  moveGrave.player.x = data.x
  moveGrave.player.y = data.y
  moveGrave.player.angle = data.angle
}

function collidePlayerVsGremlin(_player, _gremlin) {
    _gremlin.kill();
    scream.play();
    console.log('Creating new grave')
    createGrave(_gremlin.world.x, _gremlin.world.y)
    createGremlin();
    scoreval += 1;
    if (scoreval > winningval) {
      winningval = scoreval;
      socket.emit('update score', { score: winningval })
    }
  }

function update () {

  for (var i = 0; i < wallSprite.length; i++) {
    wallSprite[i].update()
    game.physics.arcade.collide(player, wallSprite[i])
  }
  for (var i = 0; i < graves.length; i++) {
    socket.emit('move grave', {id: graves[i].id, x: graves[i].player.x, y: graves[i].player.y, angle: 0 })
    graves[i].update()
    game.physics.arcade.collide(player, graves[i].player)
  }
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].alive) {
      enemies[i].update()
      game.physics.arcade.collide(player, enemies[i].player)
    }
  }

  for (var i = 0; i < gremlins.length; i++) {
    socket.emit('move gremlin', {id: gremlins[i].id, x: gremlins[i].player.x, y: gremlins[i].player.y, angle: 0})
    gremlins[i].update()
    game.physics.arcade.collide(player, gremlins[i].player, collidePlayerVsGremlin)
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
