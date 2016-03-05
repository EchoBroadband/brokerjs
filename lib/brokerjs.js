"use strict";

/*!
 * brokerjs
 * Copyright(c) 2015 Mike Whitaker
 * MIT Licensed
 */


/** 
 * @external {shortid} https://www.npmjs.com/package/shortid
 */

/** @ignore */
let shortid = require('shortid');

/** @type {string} */
const VERSION = '0.6.2';

/**
	Broker is used for inter-process communication with the goal of de-coupling classes and modules.
**/
class Broker {
	/**
	 * Creates an instance of the Broker object. 
	 *
	 * @return {Broker}
	 */
	constructor() {
		this.subscribe 		= this.on;
		this.register 		= this.on;
		this.publish 		= this.emit;
		this.trigger 		= this.emit;
		this.unsubscribe 	= this.off;
		this.unregister 	= this.off;

		// Stateful data:
		/** 
		 * A map of channel ids ("a:b:c") => array of subscription records: <br/>
		 ```javascript
		 _channels['a:b:c'] = [sub_record, sub_record, sub_record, ...] ```

		 * @type {Object} _channels
		 */
		this._channels 		= {};
		/** 
		 * A map of subscription ids => subscription record.

	  	 A subscription record looks like this:
		 ```
		  {subId:string, channelId:string, options:Object, callback:function}
		 ```

		 * @type {Object} _subscriptions
		 */
		this._subscriptions	= {};
	}

	/**
	 * Returns the current version of Broker (as in "0.1.1").
	 * @type {string}
	 */
	get version() {
		return VERSION;
	}

	/**
	 * This registers a callback on a channel with optional *options*. <br/>eg:<br/>
	 ```javascript
	 let mycallback = function(event) { console.log('Woot!',event.data); };
	 let mysubid = broker.on('gateway:processCC', mycallback);```

	 You can override the options of an existing subscription by putting a ```force:true``` parameter in your options map. eg:
	 ```javascript
	 broker.on('gateway:processCC', mycallback, {force:true, priority:1});
	 // OR:
	 broker.on('gateway:processCC', mysubid, {force:true, priority:10});
	 ```

	A subscription record looks like this:
	```
	 {subId:string, channelId:string, callback:function, options:Object}
	```

	 Includes aliases: *on*, *subscribe*, and *register*. 
	 *
	 * @param {string} channelId - Channel id, as in ```a:b:c``` or ```a:b:*```
	 * @param {function|string} callbackOrsubId - Callback or subscription id. If a callback, then an normal subscription 
	 *		is being created (or overridden with *options.force*). If it's a subscription id, then only overriding an 
	 *		existing subscription will be attempted.
	 * @param {Object} [options] - An object with options that get passed back to the callback. Some parameters are used 
	 * 		for the subscription itself. eg: ```{priority:2, mytag:'delortable', somekey:'is_not_private'}```
	 * @param {number} [options.priority=5] - The priority this subscription will hold. 0 is highest. 
	 * @param {boolean} [options.force=null] - If force is set to true and this subscription is a duplicate, *on* will 
	 * 		override the options of the existing subscription (if it exists).
	 * @param {*} [options.context=null] - Supplies callback function with context.
	 * @param {number} [options.count=null] - Auto-unsubscribe subscription after being called *count* times. 
	 * 
	 * @return {string} subscription id
	 */
	on(channelId, callbackOrsubId, options) {
		// Fail with no/invalid channelId
		if(!channelId || typeof channelId != 'string')
			throw new Error('Valid channelId required in order to subscribe to a channel.');

		// Fail if no callbackOrsubId is provided.
		if(!callbackOrsubId || (typeof callbackOrsubId != 'function' && typeof callbackOrsubId != 'string'))
			throw new Error('Callback or Subscrition Id required in order to subscribe to a channel.');

		///////////////////////////
		// options parsing:
		///////////////////////////

		// Fail if options is not an object and not null.
		if(options && typeof options != 'object')
			throw new Error('Passed options must be an object or null.');

		///////////////////////////	
		//// options.priority

		// Force options to be an object with default parameters.
		if(!options)
			options = {priority:5};

		// Force priority to exist and be a number.
		if(options.priority == null || typeof options.priority != 'number')
			options.priority = 5;

		///////////////////////////
		//// options.count

		// Check if options.count is a number, if it exists.
		if(options.count != null) {

			if(typeof options.count != 'number') {
				throw new Error('Options.count must be a number.');
			}
			else {
				// Force options.count to be an int (no floaters here).
				options.count = Math.floor(options.count);

				// Record starting count (to know what to reset to).
				options._count = options.count;
			}
		}

		///////////////////////////
		//// options.context

		//@@ Any need for checking here? We don't really care what the context is.

		///////////////////////////
		// Subscription duplication / overriding
		///////////////////////////

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
						// MAKE sure subscriptions are re-ordered, in case the priority was changed.
						sub.options = options;
					}

					subId = sub.subId;
					break;
				}
			}
		}

		if(!subId && typeof callbackOrsubId != 'function')
			throw new Error('Callback or Subscrition Id required in order to subscribe to a channel.');

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

	/** Alias for {@link on}. */
	subscribe() {}

	/** Alias for {@link on}. */
	register() {}


	/**
	 * This emits an event on a channel id with optional data. Subscriptions are called in order of channel id exactness 
	 (```a:b:c:d``` will be hit first before ```a:*```) and subscription priority (0 before > 0). Each subscription callback
	 is passed an event object and can return a Promise or nothing. Subscriptions are called in sequence via promises. 
	 The emit function itself returns a Promise that will complete after all subscribers have been called and executed.

	 Example:
	 ```javascript
	 let mysubid = broker.on('office:*', function(event) {
		console.log('An office event was broadcast: ', event);
	 });

	 broker.emit('office:servers', {command:'shutdown'});
	 ```

	 An event looks like this:
	 ```
	 {data:*, channelId:String, subscription:Object, opts:Object}
	 ```
	 Includes aliases: *emit*, *publish*, and *trigger*. 
	 *
	 * @param {string|object} channelIdOrOpts - The channel id which will be triggered (```a:b:c```) or an object containing channelId plus additional options:
	 * ```{channelId:"a:b:c", other:"option"}```
	 * @param {*} [data] - The data to be passed along to each subscriber. Can be anything, but only serializable data is recommended.
	 *
	 * @return {Promise} A Promise that will finish after all subscribers are processed.
	 */
	emit(channelIdOrOpts) {
		let ctype = typeof channelIdOrOpts;

		if(!channelIdOrOpts || (ctype != 'string' && ctype != 'object'))
			throw new Error('Invalid channelIdOrOpts provided to emit.');

		if(ctype == 'string')
			channelIdOrOpts = {channelId: channelIdOrOpts};

		if(!channelIdOrOpts.channelId || typeof channelIdOrOpts.channelId != 'string' )
			throw new Error('Missing or invalid channelId provided in emit options.');

		let data = Array.prototype.slice.call(arguments,1);

		return new Promise((complete, cancel) => {
			process.nextTick(()=> {
				this._emit(channelIdOrOpts, data, complete, cancel);
			});
		});
	}

	/** Alias for {@link emit}. */
	trigger() {}

	/** Alias for {@link emit}. */
	publish() {}

	/**
	 * This unregisters a subscription using either: a channel id + callback function, or a subscription id. 

	 eg:
	 ```javascript
	 let mycallback = function(){};
	 let mysubid = broker.on('*', mycallback);

	 broker.off('*', mycallback);
	 // OR
	 broker.off(mysubid);

	 Includes aliases: *off*, *unsubscribe*, and *unregister*.
	 *
	 * @param {string} channelIdOrsubId - A channel id or subscription id.
	 * @param {function} [callback] - The function which was registered with the subscription that is being removed. Optional if a subscription id is used.
	 *
	 * @return {Object|boolean} The subscription record removed or false.
	 */
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

	/** Alias for {@link off}. */
	unsubscribe() {}

	/** Alias for {@link off}. */
	unregister() {}	


	/**
	 * Returns all channels. Kind of dangerous if you go messing with them.
	 *
	 * @return {Object} An object map of channel id => [subscriber ids]
	 */
	getChannels() {
		/** @todo return a copy. */
		return this._channels;
	}

	/**
	 * Returns the internal map of subscriber records. If a channel id is passed, it filters the results with that id.
	 *
	 * @param {string} [channelId] - A channel id to filter the results by.
	 *
	 * @return {Object} An object map of subscriber id => subscriber record.
	 */
	getSubscribers(channelId) {
		/** @todo Send a deep copy, not direct pointers. */

		if(!channelId)
			return this._subscriptions;

		let list = {}, chan = this._channels[channelId];
		
		if(!chan)
			return list;

		for(let sub of chan)
			list[sub.subId] = sub;
		
		return list;
	}

	/**
	 * Returns a single subscription by id or null if it does not exist.
	 *
	 * @param {string} subId - A subscription id.
	 *
	 * @return {{subId:string, channelId:string, options:Object, callback:function}} A subscription record.
	 */
	getSubscription(subId) {
		return this._subscriptions[subId];
	}


	/**
	 * Clears out all subscriptions and channels.
	 */
	clear() {
		this._subscriptions = {};
		this._channels = {};
	}

	/**
	 * Clears out all subscriptions and channels.
	 * @return {string} Returns class name + current version.
	 */
	toString() {
		return 'BrokerJS version [' + this.version + ']';
	}

	/**
	 * A helper function used in emitting events. Returns an array of ordered channel ids that match
	 * the given input (including ```*``` subscriptions). eg: 
	 *
	 * ```["a:b:c:d","a:b:c:*","a:*"] ```
	 *
	 * @param {string} channelId - The channel id to compare against. 
	 *
	 * @return {Array<string>} A sorted array of channel ids.
	 */
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

	/**
	 * A magical function that processes an emit event through a prioritized channel list of subscribers using
	 recursive sequential promises. 
	 *
	 * @param {string} channelId - The channel id emitted on.
	 * @param {*} data - The data to be passed along. * **Warning:** If it is an Object then it can be modified by subscribers!*
	 * @param {function} complete - The emitter's Promise complete function to be called when all subscribers are complete.
	 * @param {function} cancel - The emitter's Promise cancel function that will never be called. :P 
	 *
	 */	
	_emit(emitOps, data, complete, cancel) {

	////////////////////////////////////////////
	// Check for matching subscriptions:

		let list = this._getMatchingChannelList(emitOps.channelId);
		// If no channels, complete promise.
		if(list.length == 0)
			return complete(true);

	////////////////////////////////////////////
	// Emit event:

		// Create event object. 
		//?? Make it a class?
		let event = {channelId:emitOps.channelId, opts:emitOps, subscription:null};
		let channels = this._channels;
		let unsubscribe = this.off.bind(this);

		// if(undefined == event.data)
		// 	event.data = null;

		// A promise generator for sequential event callbacks.
		let nextSubscriber = function* () {
			let prom, context;
			
			// Parse through ordered list
			for(let chanId of list) {
				// Call subscriptions in order of priority.
				for(let sub of channels[chanId]) {

					// Respect subscription countdown marker, if it exists.
					if(sub.options.count != null) {
						// Abort and remove subscription if we're out of count.
						/* istanbul ignore if */ 
						if(sub.options.count <= 0) {
							unsubscribe(sub.subId);
							continue;
						}

						sub.options.count--;
					}

					// Add the subscription id to the event.
					event.subscription = sub;

					// Use the provided context (or undefined as default).
					context = sub.options.context;

					// Call the subscriber's callback and yield its promise (or force it to be a promise).
					data.push(event);
					prom = Promise.resolve(sub.callback.apply(context, data));
					
					yield {promise: prom, event: event};

					if(event.cancelled)
						return;

					// Check sub.count again, as it may have reached 0 above.
					if(sub.options.count != null && sub.options.count <= 0) {
						unsubscribe(sub.subId);
					}
				}
			}
		}

		// Create an iterator for our custom iteration needs.
		let nextSubscriberIterator = nextSubscriber();

		// Promise processor
		function processSubPromise(data) {

			// Use nextTick in order to keep the call stack from overflowing.
			process.nextTick(()=> {
				// We're done! Complete the original emission (next tick so our stack won't blow up).
				if(!data || !data.promise)
					return complete(true);

				// Continue or cancel current event bubbling. 
				data.promise.then(function() {
					// Process the next subscriber in line.
					processSubPromise(nextSubscriberIterator.next().value);
				}).catch(function() {
					// An error has occurred in the event.
					// event.cancelled = true;
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

module.exports = exports = Broker;