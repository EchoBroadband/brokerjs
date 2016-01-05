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

		on(channelId, options, callbackOrsubId) {
			// Fail with no/invalid channelId
			if(!channelId || typeof channelId != 'string')
				throw new Error('Valid channelId required in order to subscribe to a channel.');

			// Allow options to be omitted; overloading it as the callback. 
			if(!callbackOrsubId && (typeof options == 'function' || typeof options == 'string')) {
				callbackOrsubId = options;
				options = null;
			}

			// Fail if no callbackOrsubId is provided.
			if(!callbackOrsubId || (typeof callbackOrsubId != 'function' && typeof callbackOrsubId != 'string'))
				throw new Error('Callback or Subscrition Id required in order to subscribe to a channel.');

			// Fail if options is not an object and not null.
			if(options && typeof options != 'object')
				throw new Error('Passed options must be an object or null.');

			// Force options to be an object with default parameters.
			if(!options)
				options = {priority:5};

			// Force priority to exist and be a number.
			if(options.priority == null || typeof options.priority != 'number')
				options.priority = 5;

			let subId;

			// Check for a duplicate subscriptions.
			let subs = this._channels[channelId];
			if(subs) {
				for(let sub of subs) {
					// Check by callback. If match found, return same subId; else it's a new subscription.
					if(callbackOrsubId === sub.callback || callbackOrsubId == sub.subId) {

						// If options exist, and "force:true" exists, override options and return existing id.
						if(options && options.force === true) {
							// Remove force command.
							delete options.force;

							// Override existing options with new ones.
							// MAKE sure it reorders in case priority was changed.
							sub.options = options;
						}

						subId = sub.subId;
						break;
					}
				}
			}

			if(!subId && typeof callbackOrsubId != 'function')
				throw new Error('Callback or required in order to subscribe to a channel.');

			// Create channel if non-existing.
			if(!this._channels[channelId])
				this._channels[channelId] = [];

			let chan = this._channels[channelId];

			// If subId is defined (due to overriding options above), don't add anything new: just reorder.
			if(!subId) {
				// Create new subscription id; making sure there aren't any duplicate ids in use. 
				do {
					subId = shortid.generate();
				} while(this._subscriptions[subId]);

				// Create the new subscription.
				let subscription = {subId:subId, channelId:channelId, options:options, callback:callbackOrsubId};

				// Add subscription to _subscriptions.
				this._subscriptions[subId] = subscription;

				// Add subscription to channel.
				chan.push(subscription);
			}

			// Sort list by priority (0 first, greater numbers last).
			chan.sort(function(a,b){return a.options.priority > b.options.priority;});

			return subId;
		}

		emit(channelId, data) {
			if(!channelId || typeof channelId != 'string')
				throw new Error('Invalid channelId provided to emit.');

			return new Promise((complete, cancel) => {
				process.nextTick(()=> {
					this._emit(channelId, data, complete, cancel);
				});
			});
		}

		// You can unsubscribe via channelId + callback, callback, or subscriptionId
		off(channelIdOrsubId, callback) {
			// Allow channelId to be omitted; overloading it to be the callback.
			if(!channelIdOrsubId && typeof channelIdOrsubId == 'function') {
				callback = channelIdOrsubId;
				channelIdOrsubId = null;
			}

			// Fail if no channelIdOrsubId and no callback provided.
			if(!channelIdOrsubId && (!callback || typeof callback != 'function'))
				throw new Error('channelIdOrsubId + callback, callback, or subscriptionId required in order to unsubscribe from a channel.');

			if(channelIdOrsubId && typeof channelIdOrsubId != 'string')
				throw new Error('channelIdOrsubId must be a string in order to unsubscribe from a channel.');

			let sub, subId;
			
			// If it has a callback, assume the channelIdOrsubId is a channel id.
			if(callback) {
				// Iterate over subscriptions and find matching callback.
				for(subId in this._subscriptions)	{
					sub = this._subscriptions[subId];
					if(sub.callback === callback && channelIdOrsubId == sub.channelId) {
						// Replace id with subscription id (where it'll be removed later).
						channelIdOrsubId = sub.subId;
						break;
					}
				}
			}

			// If we don't have a sub, assume channelIdOrsubId is a subscription id.
			if(!sub)
				sub = this._subscriptions[channelIdOrsubId];

			if(sub) {
				// Remove subscription from subs list. 
				delete this._subscriptions[channelIdOrsubId];
				
				// Check and remove subscription from channel list.
				let channel = this._channels[sub.channelId];
				if(channel) {
					for(let i = 0; i < channel.length; i++) {
						if(sub.subId == channel[i].subId) {
							channel.splice(i, 1);
						}
					}
				}

				return sub;
			}

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

		_getMatchingChannelList(channelId) {
			let list = [];
			let targetList;

			let sourceList = channelId.split(':');
			let sourceLength = sourceList.length;

			// Cycle through exising channel subscriptions and search for matches.
			for(let chan in this._channels) {
				// Default to true. it's set to false on a chunk mismatch.
				let add = true;

				// Skip if they're the same id.
				if(chan != channelId) {
					// Seperate target list				
					targetList = chan.split(':');   

					// If source is shorter than target, it's an auto-fail.
					if(sourceLength >= targetList.length) {

						// Find and break on first mismatch. eg: a:b:c:d  vs a:c:d:e   b != c and it'd break.
						for(let i=0; i < sourceLength; i++) {
							if(targetList[i] != sourceList[i]) {

								// If a star is present then add channel, otherwise they don't match so it's a no-go.
								add = (targetList[i] == '*');
								break;
							}
						}
					}
					else
						add = false;
				}
				
				if(add)
					list.push(chan);
			}

			// Sort by longest to shortest, which is most direct to least direct subscribers.
			list.sort(function(a,b){return a.length < b.length;});

			return list;
		}

		// Magic _emit function that deals with sequential async promises.
		_emit(channelId, data, complete, cancel) {

		////////////////////////////////////////////
		// Check for matching subscriptions:

			let list = this._getMatchingChannelList(channelId);
			// If no channels, complete promise.
			if(list.length == 0)
				return complete(true);

		////////////////////////////////////////////
		// Emit event:

			// Create event object. 
			//?? Make it a class?
			let event = {data:data, channelId:channelId, subscription:null};
			let channels = this._channels;

			if(undefined == event.data)
				event.data = null;

			// A promise generator for sequential event callbacks.
			let nextSubscriber = function* () {
				let prom;
				
				// Parse through ordered list
				for(let chanId of list) {
					// Call subscriptions in order of priority.
					for(let sub of channels[chanId]) {

						// Add the subscription id to the event.
						event.subscription = sub;

						// Call the subscriber's callback and yield its promise (or force it to be a promise).
						prom = Promise.resolve(sub.callback(event));
						
						yield prom;
					}
				}
			}

			// Create an iterator for our custom iteration needs.
			let nextSubscriberIterator = nextSubscriber();

			// Promise processor
			function processSubPromise(promise) {

				// Use nextTick in order to keep the call stack from overflowing.
				process.nextTick(()=> {
					// We're done! Complete the original emission (next tick so our stack won't blow up).
					if(!promise)
						return complete(true);

					// Continue or cancel current event bubbling. 
					promise.then(function() {
						// Process the next subscriber in line.
						processSubPromise(nextSubscriberIterator.next().value);
					}).catch(function() {
						// Event has been cancelled.
						event.cancelled = true;

						// cancel(event);

						//@@ Now what? The subscriber threw an error. Keep propagating?
						processSubPromise(nextSubscriberIterator.next().value);
					});
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