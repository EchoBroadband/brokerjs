"use strict";

/*!
 * brokerjs
 * Copyright(c) 2015 Mike Whitaker
 * MIT Licensed
 */


(function(){

	//@@ make compatible with browser stuff...
	let shortid = require('shortid');
	let util = require('util');

	let VERSION = '0.0.1';

	class Broker {
		/**
		 * Creates an uninitalized Core object.
		 *
		 * @return {Core}
		 */
		constructor() {
			// Provide function aliases. 
			this.subscribe 		= this.on;
			this.register 		= this.on;
			this.publish 		= this.emit;
			this.trigger 		= this.emit;
			this.unsubscribe 	= this.off;
			this.unregister 	= this.off;

			// Stateful data:
			this._channels 		= {};	// An array of channels: 'a:b:c', 'a:*', '*', etc.
			this._subscriptions	= {};	// A hash of channel => subscribers-array: ['a:*'] = [a, b, c, d]
		}

		get version() {
			return VERSION;
		}

		on(channelId, options, callback) {
			// Fail with no/invalid channelId
			if(!channelId || typeof channelId != 'string')
				throw new Error('Valid channelId required in order to subscribe to a channel.');

			// Allow options to be omitted; overloading it as the callback. 
			if(!callback && typeof options == 'function') {
				callback = options;
				options = null;
			}

			// Fail if no callback is provided.
			if(!callback || typeof callback != 'function')
				throw new Error('Callback required in order to subscribe to a channel.');

			// Fail if options is not an object and not null.
			if(options && typeof options != 'object')
				throw new Error('Passed options must be an object or null.');

			// Force options to be an object with default parameters.
			if(!options)
				options = {priority:5};

			// Force priority to be a number.
			if(options.priority == null || typeof options.priority != 'number')
				options.priority = 5;

			let subId;

			// Check for a duplicate subscriptions.
			let subs = this._channels[channelId];
			if(subs) {
				for(let sub of subs) {
					// Check by callback. If match found, return same subId; else it's a new subscription.
					if(callback === sub.callback) {

						// If options exist, and "force:true" exists, override options and return existing id.
						if(options && options.force === true) {
							// Remove force command.
							delete options.force;

							// Override existing options with new ones.
							sub.options = options;
						}

						return sub.subId;
					}
				}
			}

			// Create new subscription id; making sure there aren't any duplicate ids in use. 
			do {
				subId = shortid.generate();
			} while(this._subscriptions[subId]);

			// Create the new subscription.
			let subscription = {subId:subId, channelId:channelId, options:options, callback:callback};

			// Create channel if non-existing.
			if(!this._channels[channelId])
				this._channels[channelId] = [];

			// Add subscription to _subscriptions.
			this._subscriptions[subId] = subscription;

			// Order by priority.
			let chan = this._channels[channelId];
			let priority = subscription.options.priority; 

			for(let i = 0; i < chan.length; i++) {
				if(priority < chan[i].options.priority) {
					// Insert subscription at bottom of group with same ids.
					chan.splice(i, 0, subscription);
					return subId;
				}
			}

			// Insert subscription into bottom of array (since it didn't match anything above).
			chan.push(subscription);

			return subId;
		}

		emit(channelId, data) {
			if(!channelId || typeof channelId != 'string')
				throw new Error('Invalid channelId provided to emit.');

			return new Promise((complete, cancel) => {
				//?? Is setTimeout really necessary?
				setTimeout(() => {
					this._emit(channelId, data, complete, cancel);
				}, 1);
			});
		}

		off(channelId, callback) {
			// Allow channelId to be omitted; overloading it for the callback.
			if(!channelId && typeof channelId == 'function') {
				callback = channelId;
				channelId = null;
			}

			// Fail if no channelId and no callback provided.
			if(!channelId && (!callback || typeof callback != 'function'))
				throw new Error('ChannelId + callback, callback, or subscriptionId required in order to unsubscribe from a channel.');

			//@@ If there's no channelId but a callback, search through all and remove that callback.
			//@@ If the channelId is really a subscriptionId, directly remove that subscription.
			//@@ Otherwise, just search the channelId for the callback.

			return false;
		}

		getChannels() {
			//@@ return a copy.
			return this._channels;
		}

		getSubscribers(channelId) {
			// let list = {};
			// let channels = this._channels;

			//@@ Send a deep copy, not pointers.

			if(!channelId)
				return this._subscriptions;

			let list = {}, chan = this._channels[channelId];
			
			if(!chan)
				return list;

			for(sub in chan)
				list[sub.subId] = sub;
			
			return list;
		}

		getSubscription(subId) {
			return this._subscriptions[subId];
		}

		clear() {

		}

		toString() {
			return 'BrokerJS version [' + this.version + ']';
		}

		_emit(channelId, data, complete, cancel) {
			//@@ SUPPORT * CHANNEL IDS
			let chan = this._channels[channelId];

			// If channel does not exist, or has no followers, complete promise.
			if(!chan || chan.length == 0)
				return complete(true);

			// Create event object. 
			//?? Make it a class?
			let event = {cancelled:false, data:data, channelId:channelId, subscription:null};

			// A promise generator for sequential event callbacks.
			let nextSubscriber = function* () {
				let prom;
				// Call subscriptions in order of priority.
				for(let sub of chan) {
					// Add the subscription to the event.
					event.subscription = sub;

					// Call the subscriber's callback and yield its promise.
					prom = sub.callback(event);

					//@@ do something if prom is not a promise.
					
					yield prom;
				}
			}

			// Create an iterator for our custom iteration needs.
			let nextSubscriberIterator = nextSubscriber();

			function processSubPromise(promise) {
				// Abort if event is cancelled and for some reason this is called.
				// if(event.cancelled)
				// 	return;

				// We're done! Complete the original emit.
				if(!promise)
					return complete(true);

				// Continue or cancel current event bubbling. 
				promise.then(function() {
					// Process the next subscriber in line.
					processSubPromise(nextSubscriberIterator.next().value);
				}).catch(function() {
					// Event has been cancelled.
					event.cancelled = true;
					cancel(event);
				});
			}

			// Kickstart the recursive process.
			processSubPromise(nextSubscriberIterator.next().value);
		}

	}


	// CommonJS module
	if(typeof exports !== 'undefined') {
		if(typeof module !== 'undefined' && module.exports) {
			exports = module.exports = Broker;
		}
		exports.Broker = Broker;
	}

	// Register as an anonymous AMD module
	if(typeof define === 'function' && define.amd) {
		define([], function() {
			return Broker;
		});
	}

	// if there is a importsScrips object define chance for worker
	if(typeof importScripts !== 'undefined') {
		chance = new Broker();
	}

	// If there is a window object, that at least has a document property,
	// instantiate and define chance on the window
	if(typeof window === "object" && typeof window.document === "object") {
		window.Broker = Broker;
		window.broker = new Broker();
	}

})();