# BrokerJS (.com)

![Build Status][BS img]

[BrokerJS] is an internal application message bus dedicated to decoupling classes, modules, and so on. It supports name spaces with wild-cards. It is fully documented and thoroughly tested. View documentation and examples [here].
 
### Version
0.6.1

### Changes

##### from 0.6.0 to 0.6.1   
Fixed esdoc build errors. 

##### from 0.5.1 to 0.6.0   
`contains breaking changes!`

* Changed the order of options and callback in the *broker.on* function:
  ```javascript
  // FROM
  broker.on = function(channelId, options, callback){...};
  
  // TO
  broker.on = function(channelId, callback, options){...};
  ```
  This allows for easier subscription writing; less nulls in the middle of your calls and better drop-in-compatibility with *mediator.js*.
  
* Added additional option parameters in *broker.on*, including:
  * `options.context`:  This is the function context your subscription callback will inherit. (eg: *this* inside of your callback becomes whatever options.context is.)
  * `options.count`: This is a self-destructing callback countdown. It will decrement by one each time the callback is used. Upon hitting zero, the subscription will unsubscribe itself. The original count can be read at ```options._count```

### Tech

BrokerJS runs on [NodeJS] ~~and in the browser~~. It requires NodeJS 5.0.0 or greater (uses ECMA6) (recommend 5 branch over 4.1.3+, though it still may work).

### Installation

Node: 
```sh
$ npm install brokerjs --save
```

### Usage Example 1: using brokerjs for "callbacks"
```javascript
let Broker = require('brokerjs');
let broker = new Broker();

// Some login controller:
function login(name, password, callback) {
    broker.on('login:for:'+name, function(e) { 
        broker.off(e.subscription.subId);
        callback(e.data.result);
    });
    broker.emit('auth:login', {name:name, pw:password, responseId: 'login:for:'+name});
}

// Some auth module/class:
function constructor() {
    broker.on('auth:login', (e) => { return this.onAuthLogin(e); });
}
function onAuthLogin(event) {
    let p = new Promise((accept,reject) => {
        // Do some async DB work, auth work, etc.
        let result = true; 
        broker.emit(event.data.responseId, {result: result, hash:'123abc'});
        accept();
    });
    return p;
}
```

Alternatively, you don't always need to return a promise, depending on how you want to use broker.
```javascript
function onAuthLogin(event) {
    // Do some async DB work, auth work, etc.
    let result = true; 
    broker.emit(event.data.responseId, {result: result, hash:'123abc'});
}
```

### Usage Example 2: * channel ids
```javascript
function response(e) {
    console.log(e.subscription.channelId + ' - ' + e.data);
}

broker.on('*', response);
broker.on('app:*', response);
broker.on('app:init', response);
broker.on('app:control:shutdown', response);

broker.emit('app:control:shutdown', 'Woot!');
// displays: 
//    app:control:shutdown - Woot!
//    app:* - Woot!
//    * - Woot!

broker.emit('app:init:some:option', 'Go for it!');
// displays: 
//    app:* - Go for it!
//    * - Go for it!

broker.emit('app:init', 'Init!');
// displays: 
//    app:init - Init!
//    app:* - Init!
//    * - Init!
```

### Usage Example 3: Priorities
```javascript
let mycallback = function(e) {
    console.log('BOB');
};
broker.on('a:b', mycallback, {priority:100});

broker.on('a:b', function(e) {
    console.log('JACK');
}, {priority:2});
broker.on('a:b', function(e) {
    console.log('JIM');
}, {priority:5});
broker.on('a:b', function(e) {
    console.log('FIN');
}, {priority:3});
broker.on('*', function(e) {
    console.log('WHAAAAT?!');
}, {priority:1});

broker.emit('a:b');
// displays:
//    JACK
//    FIN
//    JIM
//    BOB
//    WHAAAAT?!

// OVERRIDING previous options
broker.on('a:b', mycallback, {priority:1});

broker.emit('a:b');
// displays:
//    BOB
//    JACK
//    FIN
//    JIM
//    WHAAAAT?!
```

### Todos

 - Finish BrokerJS.com
 - Implement easy data return from emit.
 - Implement one-off subscription call and response helpers.
   - *0.6.0*: Now partially obtainable with `option.count` support.
 - Implement two path response from subscribers.
 - Increase comment coverage

License
----

MIT


**Free Software!**

[//]: # (Links)

   [git-repo-url]: <https://github.com/echobnet/brokerjs>
   [NodeJS]: <http://nodejs.org>
   [BrokerJS]: <http://brokerjs.com>
   [here]: <http://brokerjs.com>
   [BS img]: <https://codeship.com/projects/51834170-9606-0133-3125-3e79f15ecc1c/status?branch=master>
