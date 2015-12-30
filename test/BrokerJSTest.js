"use strict";

let assert  = require('assert');
let shortid = require('shortid');
let util = require('util');
// var mockery = require('mockery');

let Broker, broker;

/** @test {BrokerJS} */
describe('BrokerJS', function() {
	before(function() {
		Broker = require('../lib/Brokerjs');
	});

	beforeEach(function() {
		// mockery.enable();
		// mockery.registerAllowable('shortid');
		// mockery.registerAllowable('util');
		// mockery.registerAllowable('../lib/Brokerjs');

		broker = new Broker();
	});

	afterEach(function() {
		// mockery.deregisterAll();
		// mockery.disable();
	});

	after(function() {
		broker = null;
	});

	/** @test {BrokerJS#api} */
	describe('Library Basics', function() {
		// beforeEach(function() {
		// });

		it('should have correct api functions', function() {
			assert(broker);

			assert(broker.version);
			assert(broker.toString());

			assert(broker.subscribe === broker.on);
			assert(broker.subscribe === broker.register);

			assert(broker.unsubscribe === broker.off);
			assert(broker.unsubscribe === broker.unregister);

			assert(broker.publish === broker.emit);
			assert(broker.publish === broker.trigger);

			assert(broker.getChannels);
			assert(broker.getSubscribers);
			assert(broker.clear);
		});

		it('.off should accept arguments properly', function() {

			// Check default expected arguments (that no error is thrown and that true/false is returned:
			let result = broker.off('a:b:c', function(){});
			assert(result === false);

			// Pass a "subscriptionId" instead of a channelId; omitting the callback
			result = broker.off('#abcd1234');
			assert(result === false);

			// Check empty arguments:
			assert.throws(function(){
				result = broker.off();
			}, 'Missing arguments with "off" function did not throw an error.');

		});
	});

	/** @test {Broker#functionality} */
	describe('#on/subscribe/register', function() {
		let testForSub = function(subId, channel, callback, extra) {
			// Get a list of subscribers and check if its valid. 
			let subs = broker.getSubscribers();
			assert.notEqual(null, subs);
			assert.notEqual(undefined, subs);

			let foundSub = null;
			for(let id in subs) {
				if(id == subId) {
					foundSub = subs[id];
					break;
				}
			}

			assert.notEqual(null, foundSub, 'No subscriber with matching subId found. (channel: '+channel+')');
			assert(foundSub.callback === callback);
			assert(foundSub.channelId === channel);

			if(extra && typeof extra == 'function')
				extra(foundSub);
		}

		// beforeEach(function() {
		// });

		it('should accept new subscriptions with options', function() {
			let mycallback = function(){};
			let channel = 'new:with:options';
			let options = {priority:1};

			let subId = broker.on(channel, options, mycallback);

			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback, function(sub) {
				assert(sub.options.priority == 1, 'Invalid/missing "options" ('+channel+').');
			});
		});

		it('should accept new subscriptions without options', function() {
			let mycallback = function(){};
			let channel = 'new:no:options';
			let subId;

			// Null options:
			subId = broker.on(channel, null, mycallback);
			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback, function(sub) {
				assert(sub.options, 'No default options.');
				assert(sub.options.priority == 5, 'Default option.priority is wrong.');
			});

			// Missing options:
			channel = 'new:missing:options';
			subId = broker.on(channel, mycallback);
			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback, function(sub) {
				assert(sub.options, 'No default options.');
				assert(sub.options.priority == 5, 'Default option.priority is wrong.');
			});
		});

		it('should fail new subscriptions with an invalid callback', function() {
			let subId, channel;

			// Missing callback with options:
			channel = 'new:no:callback:with:options';
			assert.throws(function(){
				subId = broker.on(channel, {priority:1});
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with null options:
			channel = 'new:no:callback:null:options';
			assert.throws(function(){
				subId = broker.on(channel, null);
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with no options:
			channel = 'new:no:callback:no:options';
			assert.throws(function(){
				subId = broker.on(channel);
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with null options:
			channel = 'new:string:callback:null:options';
			assert.throws(function(){
				subId = broker.on(channel, null, 'broken!');
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with null options:
			channel = 'new:number:callback:null:options';
			assert.throws(function(){
				subId = broker.on(channel, null, 12358);
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with no options:
			channel = 'new:string:callback:no:options';
			assert.throws(function(){
				subId = broker.on(channel, 'broken!');
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with no options:
			channel = 'new:number:callback:no:options';
			assert.throws(function(){
				subId = broker.on(channel, 12358);
			}, 'Invalid callback function did not throw an error ('+channel+').');
		});


		it('should fail new subscriptions with invalid channel', function() {
			let subId, channel;

			// Null channel with options and callback
			channel = null;
			assert.throws(function(){
				subId = broker.on(channel, {priority:1}, function(){});
			}, 'Invalid callback function did not throw an error (null with options and callback).');

			// missing channel with options and callback
			assert.throws(function(){
				subId = broker.on({priority:1}, function(){});
			}, 'Invalid callback function did not throw an error (missing with options and callback).');

			// number channel with options and callback
			assert.throws(function(){
				subId = broker.on(12358, {priority:1}, function(){});
			}, 'Invalid callback function did not throw an error (number with options and callback).');

		});


		it('should fail new subscriptions with invalid options', function() {
			let mycallback = function(){};
			let channel;
			let subId;

			// String options
			channel = 'new:string:options';
			assert.throws(function(){
				subId = broker.on(channel, 'blahblahblah', mycallback);
			}, 'String options did not throw an error ('+channel+').');
			
			channel = 'new:number:options';
			assert.throws(function(){
				subId = broker.on(channel, 12358, mycallback);
			}, 'Number options did not throw an error ('+channel+').');

			channel = 'new:function :options';
			assert.throws(function(){
				subId = broker.on(channel, function(){}, mycallback);
			}, 'Function options did not throw an error ('+channel+').');
		});


		it('should not duplicate existing subscriptions', function() {
			let subId, channel, dupSubId;
			let mycallback = function(){};

			// Create initial subscription
			channel = 'new:to:be:duplicated';
			subId = broker.on(channel, mycallback);
			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback);

			// Try to re-add subscription
			dupSubId = broker.on(channel, mycallback);
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId.');
			});

			// Try to re-add subscription with different options
			dupSubId = broker.on(channel, {some:'options'}, mycallback);
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + options)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId.');
			});
		});

		it('should allow forced options onto existing subscriptions', function() {
			let subId, channel, dupSubId;
			let mycallback = function(){};

			// Create initial subscription
			channel = 'new:to:be:forced';
			subId = broker.on(channel, {priority:5}, mycallback);
			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback);

			// Try to re-add subscription with force flag.
			dupSubId = broker.on(channel, {priority:1, force:true}, mycallback);
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + forced)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId with force flag.');
				assert(sub.options.priority === 1, 'Forced options do not match.');
			});

			// Try to re-add subscription without force flag.
			dupSubId = broker.on(channel, {priority:9001}, mycallback);
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + not-forced)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId without force flag.');
				assert(sub.options.priority === 1, 'Not-forced options were changed.');
			});
		});
	});	// End "on" test.

	/** @test {Broker#emit/publish/trigger} */
	describe('#emit/publish/trigger', function() {
		// beforeEach(function() {
		// });

/**

	Write tests for: 
		priorities
		cancellations
		* patterns
		event object integrity
*/

		it('it should emit with valid channelId and no data', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:valid:id';
			let emitted = false;

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert.equal(null, event.data, 'Data on no-data emit was not null ('+chanId+')');
				emitted = true;

				return new Promise((complete, cancel)=>{
					complete();
				});
			});

			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emition at promise resolution.
			result.then(function(){
				assert(emitted == true, 'Event was never emitted ('+chanId+')');
				done();
			}).catch(done);
		});

		it('it should emit with valid channelId and data', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:valid:id:and:data';
			let emitted = false;
			let data = {name:'bob'};

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert(event.data, 'Data was null ('+chanId+') ' + util.inspect(event));
				assert(event.data.name == 'bob', 'Data was wrong ('+chanId+')');
				emitted = true;
			});

			let result = broker.emit(chanId, data);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emition at promise resolution.
			result.then(function(){
				assert(emitted === true, 'Event was never emitted ('+chanId+')');
				done();
			}).catch(done);
		});

		it('it should emit with a valid non-existant channelId', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:nonexistant:id';
			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emition at promise resolution.
			result.then(function(){
				done();
			}).catch(done);
		});		

		it('it should fail with an invalid channelId', function() {
			let result;

			// Test missing channel id and data.
			assert.throws(function(){
				result = broker.emit();
			}, 'Missing channelId on "emit" did not throw an error.');

			// Test with number channel id.
			assert.throws(function(){
				result = broker.emit(12358);
			}, 'Number channelId on "emit" did not throw an error.');

			// Test with function channel id.
			assert.throws(function(){
				result = broker.emit(function(){});
			}, 'Function channelId on "emit" did not throw an error.');

			// Test with an object channel id.
			assert.throws(function(){
				result = broker.emit({});
			}, 'Function channelId on "emit" did not throw an error.');			
		});

	}); // End "emit" test.


});