# BrokerJS (.com)

![Build Status][BS img]

[BrokerJS] is an internal application message bus dedicated to decoupling classes, modules, and so on. It supports name spaces with wild-cards. It is fully documented and thoroughly tested. View documentation and examples [here].
 
### Version
0.5.0

### Tech

BrokerJS runs on [NodeJS] ~~and in the browser~~. It requires NodeJS 4.0.0 or greater (uses ECMA6).

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
broker.on('a:b', {priority:100}, mycallback);

broker.on('a:b', {priority:2}, function(e) {
    console.log('JACK');
});
broker.on('a:b', {priority:5}, function(e) {
    console.log('JIM');
});
broker.on('a:b', {priority:3}, function(e) {
    console.log('FIN');
});
broker.on('*', {priority:1}, function(e) {
    console.log('WHAAAAT?!');
});

broker.emit('a:b');
// displays:
//    JACK
//    FIN
//    JIM
//    BOB
//    WHAAAAT?!

// OVERRIDING previous options
broker.on('a:b', {priority:1}, mycallback);

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
