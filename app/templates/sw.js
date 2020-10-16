// seeded random number generator
// https://github.com/davidbau/seedrandom
// cdnjs.cloudflare.com/ajax/libs/seedrandom/2.4.3/seedrandom.min.js
!function(a,b){function c(c,j,k){var n=[];j=1==j?{entropy:!0}:j||{};var s=g(f(j.entropy?[c,i(a)]:null==c?h():c,3),n),t=new d(n),u=function(){for(var a=t.g(m),b=p,c=0;a<q;)a=(a+c)*l,b*=l,c=t.g(1);for(;a>=r;)a/=2,b/=2,c>>>=1;return(a+c)/b};return u.int32=function(){return 0|t.g(4)},u.quick=function(){return t.g(4)/4294967296},u.double=u,g(i(t.S),a),(j.pass||k||function(a,c,d,f){return f&&(f.S&&e(f,t),a.state=function(){return e(t,{})}),d?(b[o]=a,c):a})(u,s,"global"in j?j.global:this==b,j.state)}function d(a){var b,c=a.length,d=this,e=0,f=d.i=d.j=0,g=d.S=[];for(c||(a=[c++]);e<l;)g[e]=e++;for(e=0;e<l;e++)g[e]=g[f=s&f+a[e%c]+(b=g[e])],g[f]=b;(d.g=function(a){for(var b,c=0,e=d.i,f=d.j,g=d.S;a--;)b=g[e=s&e+1],c=c*l+g[s&(g[e]=g[f=s&f+b])+(g[f]=b)];return d.i=e,d.j=f,c})(l)}function e(a,b){return b.i=a.i,b.j=a.j,b.S=a.S.slice(),b}function f(a,b){var c,d=[],e=typeof a;if(b&&"object"==e)for(c in a)try{d.push(f(a[c],b-1))}catch(a){}return d.length?d:"string"==e?a:a+"\0"}function g(a,b){for(var c,d=a+"",e=0;e<d.length;)b[s&e]=s&(c^=19*b[s&e])+d.charCodeAt(e++);return i(b)}function h(){try{var b;return j&&(b=j.randomBytes)?b=b(l):(b=new Uint8Array(l),(k.crypto||k.msCrypto).getRandomValues(b)),i(b)}catch(b){var c=k.navigator,d=c&&c.plugins;return[+new Date,k,d,k.screen,i(a)]}}function i(a){return String.fromCharCode.apply(0,a)}var j,k=this,l=256,m=6,n=52,o="random",p=b.pow(l,m),q=b.pow(2,n),r=2*q,s=l-1;if(b["seed"+o]=c,g(b.random(),a),"object"==typeof module&&module.exports){module.exports=c;try{j=require("crypto")}catch(a){}}else"function"==typeof define&&define.amd&&define(function(){return c})}([],Math);

// global vars
var ip_addr = "localhost:5000", sw_trace = "", key = -1;
var enc = new TextEncoder(), dec = new TextDecoder(); // utf-8

// WRIT library
var lib_js = `(function lib_js()
{
    let _obj = {};

    // private methods
    async function _fetch(...args) // custom fetch
    {
        let response = await fetch(...args); // , {credentials: "same-origin"}
        if (response.ok)
        {
            let txt = await response.text();
            return txt;
        }
    }

    function create_stack_layer(prev, next)
    {
        let new_func = () =>
        {
           prev();
           return next();
        };
        Object.defineProperty(new_func, "name", {value: prev.name, writable: false});

        return new_func;
    }

    function stack_trace()
    {
        // preserve deault stl
        let stl = Error.stackTraceLimit;
        // remove stl limit
        Error.stackTraceLimit = Infinity;
        //get trace
        let trace = new Error().stack || "";
        // restore old stl
        Error.stackTraceLimit = stl;

        return trace;
    }

    function gen_trace(rng_seed, protected, func_count)
    {
        // use SW's seed to generate pseudorandom series of numbers
        let prng = new Math.seedrandom(rng_seed);
        let number_array = [];
        for (let i = 0; i < func_count; i++)
            number_array.push(Math.abs(prng.int32()) % func_count); // % func_count optional

        // hook original function, force trace in it
        if (protected)
        {
            let original = protected.func;
            protected.func = () =>
            {
                // get the trace now
                let trace = stack_trace();
                // run the page's function
                let request = original(protected.args);
                // get trace out so it can be passed to SW
                return {trace, request};
            }
            Object.defineProperty(protected.func, "name", {value: original.name, writable: false});
        }

        // array to store new funcs
        let funcs = [];
        // base name for functions
        let name = "function_";

        // iterate pseudorandom number array
        number_array.forEach((value, index) =>
        {
            // if last number, then last function must call the func to protect
            if (index === number_array.length - 1)
            {
                if (protected)
                    funcs.push(() => protected.func());
                else
                    funcs.push(() => stack_trace());
            }
            else    // insert new func that calls the next func within, in order of input array
                funcs.push(() => funcs[index + 1]());

            // rename every function
            Object.defineProperty(funcs[index], "name", {value: name + value, writable: false});
        });

        // start chain call
        let ret = funcs[0]();
        ret.numbers = number_array.join("");

        return ret;
    }

    function sleep(ms)
    {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function unregister()
    {
        let reg = await navigator.serviceWorker.getRegistration();
        reg.unregister();
    }

    async function post(callback, args, e, funcs=10)
    {
        if (e && e.isTrusted === false)
        {
            // alert("Artificial event fired!");
            return new Error("Artificial event fired!");
        }

        let protected = {};
        if (callback)
        {
            protected.func = callback;
            protected.args = args;
        }
        else
            return new Error("No callback provided!");

        // get seed from SW
        let rng_seed = await _fetch("/rng_seed", {body: funcs.toString(), method: "POST"});
        rng_seed = parseInt(rng_seed);

        // generate the stack trace
        let ret = gen_trace(rng_seed, protected, funcs);

        // send stack trace to SW
        let resp = await fetch("/trace", {body: JSON.stringify(ret), method: "POST"});

        // return server's response to client/page
        return resp;
    };

    // public methods
    _obj.post = async (callback, args, e, funcs) => await post(callback, args, e, funcs);

    return _obj;
})()`;

// utility functions
function array_avg(array, wipe)
{
    let avg = array.reduce((a, b) => a + b, 0) / array.length;
    if (wipe === 1)
        sign_time = [];
    else if (wipe === 2)
        send_time = [];
    return avg;
}

function buf2hex(buffer)
{
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function hmac_prep()    // async - returns promise
{
    let hmac = {name: "HMAC", hash: "SHA-512"};
    let enc_key = enc.encode(key);
    let buf_key = enc_key.buffer;
    return crypto.subtle.importKey("raw", buf_key, hmac, true, ["sign", "verify"]);
}

function reverse(s)
{
    return s.split("").reverse().join("");
}

// SW functions

// SW installation
self.addEventListener("install", function(event)
{
    self.skipWaiting();
});

// SW activation
self.addEventListener("activate", function(event)
{
    self.clients.claim();
});

// SW fetching/responding
self.addEventListener("fetch", async function(event)
{
    let req = event.request;
    let url = req.url;

    if (url.includes(ip_addr) && (url.match(/\//g) || []).length === 3)
    {
        let url_post = url.split("/");
        url_post = url_post[url_post.length-1]
        if (url_post.split("?")[0] === "key")
            url_post = "key";
        let dest = ["lib.js", "id", "key", "rng_seed", "trace"];

        //check if url includes one of our functions
        if (dest.includes(url_post))
        {
            //perform action only in case it contains our function postfix
            if (url_post === "lib.js")
                event.respondWith(new Response(lib_js, {"status": 200}));
            else if (url_post === "key")
            {
                if (key === -1) // get key from server using id (during setup phase)
                {
                    event.respondWith(
                        new Promise((resolve, reject) =>
                        {
                            fetch(req)
                            .then((resp) => resp.text())
                            .then((_key) => {
                                key = _key;
                                resolve(new Response("", {"status": 200}));
                            });
                        })
                    );
                }
                else // future requests for the key are denied (the server would as well)
                    event.respondWith(new Response("", {"status": 404}));
            }
            else if (url_post === "rng_seed")
            {
                event.respondWith(
                    req.text().then((_func_count) =>
                    {
                        let func_count = parseInt(_func_count); // # of "layers" on stack trace
                        let seed_generator = new Math.seedrandom('added entropy!', {entropy: true});
                        let rng_seed = Math.abs(seed_generator.int32());
                        let prng = new Math.seedrandom(rng_seed); // seeded generator

                        sw_trace = ""; // pre-compute numbers the page has to match
                        for (let i = 0; i < func_count; i++)
                        {
                            sw_trace += Math.abs(prng.int32()) % func_count;
                        }

                        return new Response(rng_seed, {"status": 200});
                    })
                );
            }
            else if (url_post === "trace")
            {
                event.respondWith((async () => {

                    // unpack request data
                    let data = await req.clone().text();
                    let parsed = JSON.parse(data);
                    let stack_trace = parsed.trace; // page's trace
                    let layers = parsed.numbers; // raw numbers ("layers") on trace
                    let request = JSON.stringify(parsed.request); // page's request

                    // create SW signature
                    let buf_base = (enc.encode(request)).buffer; // encode req and buffer-ize
                    let crypto_key = await hmac_prep();
                    let sig = await crypto.subtle.sign("HMAC", crypto_key, buf_base);

                    // check if numbers on trace match
                    let valid = 1;
                    if (sw_trace !== layers)
                        valid = 0;

                    // send page's request + signature to server
                    let signature = buf2hex(sig);
                    let package = JSON.stringify({"data": request, "signature": signature, "valid": valid});
                    let args = {body: package, method: "POST", headers: {"Content-Type": "application/json"}};

                    let resp = await fetch(req, args);

                    // process server response if needed
                    // ...

                    // return server response to page
                    return resp;
                })());
            }
        }
        else
        {
            // servicing requests from the network
            event.respondWith(
                (async () => {
                    let resp;
                    try {
                        resp = await fetch(req);  //, {credentials: "same-origin"})
                    }
                    catch (err) {
                        console.log(err);
                    }
                    finally {
                        if (resp)
                            return resp;
                        else
                            return new Response("not ok!", {"status": 400});
                    }
                })()
            );
        }
    }
});
