class Gremlin extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, game x, y, key, type) {
        super(scene, x, y, key, type);
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.game.add.sprite(x, y, 'gremlin');
}
