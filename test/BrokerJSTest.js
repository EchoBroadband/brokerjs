"use strict";

let assert  = require('assert');
let shortid = require('shortid');
let util = require('util');
// var mockery = require('mockery');

let Broker, broker;

const VERSION = '0.6.1';

/** @test {Broker} */
describe('Broker', function() {
	before(function() {
		Broker = require('../lib/brokerjs');
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

	/** @test {Broker#api} */
	describe('Library Basics', function() {
		// beforeEach(function() {
		// });

		it('should have correct api functions', function() {
			assert(broker);

			assert.equal(broker.version, VERSION);
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

	});

	/** @test {Broker#on} */
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

		it('should accept new subscriptions with options', function() {
			let mycallback = function(){};
			let channel = 'new:with:options';
			let options = {priority:1};

			let subId = broker.on(channel, mycallback, options);

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
			subId = broker.on(channel, mycallback, null);
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
				subId = broker.on(channel, null, {priority:1});
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
				subId = broker.on(channel, 'broken!', null);
			}, 'Invalid callback function did not throw an error ('+channel+').');

			// Invalid callback with null options:
			channel = 'new:number:callback:null:options';
			assert.throws(function(){
				subId = broker.on(channel, 12358, null);
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
				subId = broker.on(channel, function(){}, {priority:1});
			}, 'Invalid callback function did not throw an error (null with options and callback).');

			// missing channel with options and callback
			assert.throws(function(){
				subId = broker.on(function(){}, {priority:1});
			}, 'Invalid callback function did not throw an error (missing with options and callback).');

			// number channel with options and callback
			assert.throws(function(){
				subId = broker.on(12358, function(){}, {priority:1});
			}, 'Invalid callback function did not throw an error (number with options and callback).');

		});


		it('should fail new subscriptions with invalid options', function() {
			let mycallback = function(){};
			let channel;
			let subId;

			// String options
			channel = 'new:string:options';
			assert.throws(function(){
				subId = broker.on(channel, mycallback, 'blahblahblah');
			}, 'String options did not throw an error ('+channel+').');
			
			channel = 'new:number:options';
			assert.throws(function(){
				subId = broker.on(channel, mycallback, 12358);
			}, 'Number options did not throw an error ('+channel+').');

			channel = 'new:function:options';
			assert.throws(function(){
				subId = broker.on(channel, mycallback, function(){});
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
			dupSubId = broker.on(channel, mycallback, {some:'options'});
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + options)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId.');
			});
		});

		it('should allow forced options onto existing subscriptions with callback', function() {
			let subId, channel, dupSubId;
			let mycallback = function(){};

			// Create initial subscription
			channel = 'new:to:be:forced:with:callback';
			subId = broker.on(channel, mycallback, {priority:5});
			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback);

			// Try to re-add subscription with force flag.
			dupSubId = broker.on(channel, mycallback, {priority:1, force:true});
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + forced)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId with force flag.');
				assert(sub.options.priority === 1, 'Forced options do not match.');
			});

			// Try to re-add subscription without force flag.
			dupSubId = broker.on(channel, mycallback, {priority:9001});
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + not-forced)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId without force flag.');
				assert(sub.options.priority === 1, 'Not-forced options were changed.');
			});
		});

		it('should allow forced options onto existing subscriptions with subId', function() {
			let subId, channel, dupSubId;
			let mycallback = function(){};

			// Create initial subscription
			channel = 'new:to:be:forced:with:subId';
			subId = broker.on(channel, mycallback, {priority:5});
			assert(shortid.isValid(subId), 'Invalid subscription id returned ('+channel+').');
			testForSub(subId, channel, mycallback);

			// Try to re-add subscription with force flag.
			dupSubId = broker.on(channel, subId, {priority:1, force:true});
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + forced)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId with force flag.');
				assert(sub.options.priority === 1, 'Forced options do not match.');
			});

			// Try to re-add subscription without force flag.
			dupSubId = broker.on(channel, mycallback, {priority:9001});
			assert(shortid.isValid(dupSubId), 'Invalid subscription id returned (duped + not-forced)('+channel+').');
			testForSub(dupSubId, channel, mycallback, function(sub){
				assert(dupSubId == subId, 'DupSubId does not equal subId without force flag.');
				assert(sub.options.priority === 1, 'Not-forced options were changed.');
			});
		});

	});	// End "on" test.

	/** @test {Broker#emit} */
	describe('#emit/publish/trigger', function() {
		it('should emit with valid channelId and no data', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:valid:id';
			let emitted = false;

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert(event.channelId == 'emit:valid:id', 'ChannelId was incorrect.');
				assert(event.subscription.channelId == 'emit:valid:id', 'Subscription channelId was incorrect.');
				assert.equal(null, event.data, 'Data on no-data emit was not null ('+chanId+')');
				emitted = true;
			});

			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				assert(emitted == true, 'Event was never emitted ('+chanId+')');
				done();
			}).catch(done);
		});

		it('should emit with valid channelId and data', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:valid:id:and:data';
			let emitted = false;
			let data = {name:'bob'};

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert(event.channelId == 'emit:valid:id:and:data', 'ChannelId was incorrect.');
				assert(event.subscription.channelId == 'emit:valid:id:and:data', 'Subscription channelId was incorrect.');
				assert(event.data, 'Data was null ('+chanId+') ' + util.inspect(event));
				assert(event.data.name == 'bob', 'Data was wrong ('+chanId+')');
				emitted = true;
			});

			let result = broker.emit(chanId, data);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				assert(emitted === true, 'Event was never emitted ('+chanId+')');
				done();
			}).catch(done);
		});

		it('should emit with a valid non-existant channelId', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:nonexistant:id';
			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				done();
			}).catch(done);
		});

		it('should emit with proper context', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:with:context';
			let myObj = {name:'bob'};
			let emitted = false;

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert.equal(this, myObj, 'Context was wrong ('+chanId+')');
				assert.equal(this.name, 'bob', 'Context name was wrong ('+chanId+')');
				emitted = true;
			}, {context:myObj});

			let result = broker.emit(chanId);

			// Verify completion of emission at promise resolution.
			result.then(function() {
				assert(emitted === true, 'Event was never emitted ('+chanId+')');
				done();
			}).catch(done);
		});

		it('should emit properly with * subscriptions', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:with:*';
			let emitted = false;
			let data = {name:'bob'};

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert(event.channelId == 'emit:with:random:id', 'ChannelId was incorrect.');
				assert(event.subscription.channelId == 'emit:with:*', 'Subscription channelId was incorrect.');
				assert(event.data, 'Data was null ('+chanId+') ' + util.inspect(event));
				assert(event.data.name == 'bob', 'Data was wrong ('+chanId+')');

				emitted = true;
			});

			let result = broker.emit('emit:with:random:id', data);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				assert(emitted === true, 'Event was never emitted ('+chanId+')');
				done();
			}).catch(done);

		});

		it('should emit in order of subscription priorities', function(done) {
			let chanId = 'emit:with:priorities';
			let correctOrder = '136';
			let testedOrder = '';

			// Listen to what's emitted.
			broker.on(chanId, function(event) {
				assert(event.channelId == chanId, 'ChannelId was incorrect.');
				assert(event.subscription.channelId == chanId, 'Subscription channelId was incorrect.');
				assert(event.subscription.options.priority == 6, 'Priority was incorrect ('+chanId+') ' + util.inspect(event));

				testedOrder += event.subscription.options.priority;
			}, {priority:6});

			broker.on(chanId, function(event) {
				assert(event.channelId == chanId, 'ChannelId was incorrect.');
				assert(event.subscription.channelId == chanId, 'Subscription channelId was incorrect.');
				assert(event.subscription.options.priority == 1, 'Priority was incorrect ('+chanId+') ' + util.inspect(event));

				testedOrder += event.subscription.options.priority;
			}, {priority:1});

			broker.on(chanId, function(event) {
				assert(event.channelId == chanId, 'ChannelId was incorrect.');
				assert(event.subscription.channelId == chanId, 'Subscription channelId was incorrect.');
				assert(event.subscription.options.priority == 3, 'Priority was incorrect ('+chanId+') ' + util.inspect(event));

				testedOrder += event.subscription.options.priority;
			}, {priority:3});

			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				assert(testedOrder.length == correctOrder.length, 'Tested Order length not correct ('+chanId+').');
				assert(testedOrder == correctOrder, 'Tested order was not in order [' + testedOrder + '] ('+chanId+').');
				done();
			}).catch(done);
		});

		it('should re-order channel subscription lists when forced options are applied', function(done) {
			let chanId = 'emit:with:priorities';
			let correctOrder = '123';
			let testedOrder = '';


			let subCallback = function(event) {
				assert(event.channelId == chanId, 'ChannelId was incorrect.');
				assert(event.subscription.channelId == chanId, 'Subscription channelId was incorrect.');
				assert(event.subscription.options.priority == 2, 'Priority was incorrect ('+chanId+') ' + util.inspect(event));

				testedOrder += event.subscription.options.priority;
			};

			let subId = broker.on(chanId, subCallback, {priority:6});

			broker.on(chanId, function(event) {
				assert(event.channelId == chanId, 'ChannelId was incorrect.');
				assert(event.subscription.channelId == chanId, 'Subscription channelId was incorrect.');
				assert(event.subscription.options.priority == 1, 'Priority was incorrect ('+chanId+') ' + util.inspect(event));

				testedOrder += event.subscription.options.priority;
			}, {priority:1});

			broker.on(chanId, function(event) {
				assert(event.channelId == chanId, 'ChannelId was incorrect.');
				assert(event.subscription.channelId == chanId, 'Subscription channelId was incorrect.');
				assert(event.subscription.options.priority == 3, 'Priority was incorrect ('+chanId+') ' + util.inspect(event));

				testedOrder += event.subscription.options.priority;
			}, {priority:3});

			// Override with a forced option!
			let newId = broker.on(chanId, subCallback, {priority:2, force:true});

			assert(newId == subId, 'Forced subscription id is not the same as the previous id.');

			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				assert(testedOrder.length == correctOrder.length, 'Tested Order length not correct ['+testedOrder+'] ('+chanId+').');
				assert(testedOrder == correctOrder, 'Tested order was not in order [' + testedOrder + '] ('+chanId+').');
				done();
			}).catch(done);
		});


		it('should emit to multiple channelIds in order of length', function(done) {
			let chanId = 'emit:to:multiple:channel:ids:in:order';
			let correctOrder = '12345';
			let testedOrder = '';

			broker.on('emit:to:*', function(event) {
				assert(event.subscription.options.id == 5, 'Data id was incorrect ('+chanId+') ' + util.inspect(event));
				testedOrder += event.subscription.options.id;
			}, {id:5});

			broker.on('emit:to:multiple:channel:ids:in:order', function(event) {
				assert(event.subscription.options.id == 1, 'Data id was incorrect ('+chanId+') ' + util.inspect(event));
				testedOrder += event.subscription.options.id;
			}, {id:1});

			broker.on('emit:to:multiple:*', function(event) {
				assert(event.subscription.options.id == 4, 'Data id was incorrect ('+chanId+') ' + util.inspect(event));
				testedOrder += event.subscription.options.id;
			}, {id:4});

			broker.on('emit:to:multiple:channel:ids:*', function(event) {
				assert(event.subscription.options.id == 2, 'Data id was incorrect ('+chanId+') ' + util.inspect(event));
				testedOrder += event.subscription.options.id;
			}, {id:2});

			broker.on('emit:to:multiple:channel:*', function(event) {
				assert(event.subscription.options.id == 3, 'Data id was incorrect ('+chanId+') ' + util.inspect(event));
				testedOrder += event.subscription.options.id;
			}, {id:3});

			let result = broker.emit(chanId);

			// Make sure we're returned a promise.
			assert(result instanceof Promise, 'Emit did not return a promise ('+chanId+').');

			// Verify completion of emission at promise resolution.
			result.then(function(){
				assert(testedOrder.length == correctOrder.length, 'Tested Order length not correct ('+testedOrder+') ('+chanId+').');
				assert(testedOrder == correctOrder, 'Tested order was not in order [' + testedOrder + '] ('+chanId+').');
				done();
			}).catch(done);
		});

		it('should unsubscribe after count reaches zero', function(done) {
			// Check default expected arguments:
			let chanId = 'emit:with:count:3';
			let emitted = 0;
			let subId = broker.on(chanId, function(event) {
				emitted++;
			}, {count: 3});

			let result1, result2, result3;

			result1 = broker.emit(chanId);
			// Verify completion of emission at promise resolution.
			result1.then(function() {
				assert(emitted == 1, 'Event is out of sync with count 1 ('+chanId+') count: '+emitted);

				result2 = broker.emit(chanId);
				// Verify completion of emission at promise resolution.
				result2.then(function() {
					assert(emitted == 2, 'Event is out of sync with count 2 ('+chanId+') count: '+emitted);
					result3 = broker.emit(chanId);
		
					// Verify completion of emission at promise resolution.
					result3.then(function() {
						assert(emitted == 3, 'Event is out of sync with count 3 ('+chanId+') count: '+emitted);
						
						// Make sure the subscription has been removed.
						let subs = broker.getSubscribers();

						// Make sure it's there...
						assert(!subs[subId], 'Options.count failed to remove subscription ('+chanId+').');
						done();
					}).catch(done);
				}).catch(done);
			}).catch(done);
		});


		it('should fail with an invalid channelId', function() {
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

	/** @test {Broker#off} */
	describe('#off/unsubscribe/unregister', function() {
		it('should ignore the unsubscription of an non-existant subscription/channel id', function() {
			// Check default expected arguments (that no error is thrown and that true/false is returned:
			let result = broker.off('a:b:c', function(){});
			assert(result === false);

			// Pass an arbitrary hash/id instead of a channelId; omitting the callback
			result = broker.off('abcd1234');
			assert(result === false);
		});

		it('should fail when passed incorrect arguments', function(){
			assert.throws(function(){
				broker.off();
			}, '.off did not throw error with no exceptions.');

			assert.throws(function() {
				broker.off(123, function(){});
			}, '.off did not throw error with number + function combo.');

			assert.throws(function() {
				broker.off(123);
			}, '.off did not throw error with number.');

			assert.throws(function() {
				broker.off({}, function(){});
			}, '.off did not throw error with object + function combo.');

			assert.throws(function() {
				broker.off({});
			}, '.off did not throw error with object.');

			assert.throws(function() {
				broker.off({}, 123);
			}, '.off did not throw error with object + number combo.');

			assert.throws(function() {
				broker.off(123, {});
			}, '.off did not throw error with number + object combo.');

			assert.throws(function() {
				broker.off(function(){});
			}, '.off did not throw error with single function.');
		});

		it('should accept unsubscription with a valid channel id and callback', function() {
			let channel = 'valid:unsub:with:channel:id:and:callback';
			let callback = function(){};
			let subId = broker.on(channel, callback);
			let subs = broker.getSubscribers();

			// Make sure it's there...
			assert(subs[subId], 'Subscription addition failed in unsubscription test ('+channel+').');

			broker.off(channel, callback);

			subs = broker.getSubscribers();
			assert(!subs[subId], 'Subscription was not removed properly ('+channel+').');
		});

		it('should accept unsubscription with a valid subscription id', function() {
			let channel = 'valid:unsub:with:subscription:id';
			let callback = function(){};
			let subId = broker.on(channel, callback);
			let subs = broker.getSubscribers();

			// Make sure it's there...
			assert(subs[subId], 'Subscription addition failed in unsubscription test ('+channel+').');

			broker.off(subId);

			subs = broker.getSubscribers();
			assert(!subs[subId], 'Subscription was not removed properly ('+channel+').');
		});

	}); // End #off/unsubscribe/deregister


});