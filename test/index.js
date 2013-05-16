/**
 * Test dependencies
 */

var axis = require('../'),
    assert = require('assert');

/**
 * axis tests
 */

describe('axis', function() {
  var luke, darth, han;

  before(function() {
    luke = axis(4000);
    darth = axis(4001);
    han = axis(4002);
  });

  it('should broadcast to all clients', function(done) {
    var i = 1;

    darth.once('message', inc);
    han.once('message', inc);
    luke.connect(4001, 4002);
    luke.send('Darth is my father.');

    function inc() {
      if(i === 2) return done();
      i = i + 1;
    }
  });

  it('should properly send objects', function(done) {
    luke.once('message', function(message) {
      assert.strictEqual(typeof message, 'object');
      assert.deepEqual(message, {darth: 'Luke, I am your father.'});
      return done();
    });

    darth.connect(4000);
    darth.send({darth: 'Luke, I am your father.'});
  });

  it('should properly send strings', function(done) {
    luke.once('message', function(message) {
      assert.strictEqual(typeof message, 'string');
      assert.deepEqual(message, 'Great, kid. Dont get cocky.');
      return done();
    });

    han.connect(4002);
    han.send('Great, kid. Dont get cocky.');
  });

  it('should properly send buffers', function(done) {
    luke.once('message', function(message) {
      assert.strictEqual(true, Buffer.isBuffer(message));
      assert.deepEqual(message, new Buffer('YAHOOO!'));
      return done();
    });

    han.connect(4002);
    han.send(new Buffer('YAHOOO!'));
  });
});