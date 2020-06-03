//seeded random number generator
//https://github.com/davidbau/seedrandom
//cdnjs.cloudflare.com/ajax/libs/seedrandom/2.4.3/seedrandom.min.js
!function(a,b){function c(c,j,k){var n=[];j=1==j?{entropy:!0}:j||{};var s=g(f(j.entropy?[c,i(a)]:null==c?h():c,3),n),t=new d(n),u=function(){for(var a=t.g(m),b=p,c=0;a<q;)a=(a+c)*l,b*=l,c=t.g(1);for(;a>=r;)a/=2,b/=2,c>>>=1;return(a+c)/b};return u.int32=function(){return 0|t.g(4)},u.quick=function(){return t.g(4)/4294967296},u.double=u,g(i(t.S),a),(j.pass||k||function(a,c,d,f){return f&&(f.S&&e(f,t),a.state=function(){return e(t,{})}),d?(b[o]=a,c):a})(u,s,"global"in j?j.global:this==b,j.state)}function d(a){var b,c=a.length,d=this,e=0,f=d.i=d.j=0,g=d.S=[];for(c||(a=[c++]);e<l;)g[e]=e++;for(e=0;e<l;e++)g[e]=g[f=s&f+a[e%c]+(b=g[e])],g[f]=b;(d.g=function(a){for(var b,c=0,e=d.i,f=d.j,g=d.S;a--;)b=g[e=s&e+1],c=c*l+g[s&(g[e]=g[f=s&f+b])+(g[f]=b)];return d.i=e,d.j=f,c})(l)}function e(a,b){return b.i=a.i,b.j=a.j,b.S=a.S.slice(),b}function f(a,b){var c,d=[],e=typeof a;if(b&&"object"==e)for(c in a)try{d.push(f(a[c],b-1))}catch(a){}return d.length?d:"string"==e?a:a+"\0"}function g(a,b){for(var c,d=a+"",e=0;e<d.length;)b[s&e]=s&(c^=19*b[s&e])+d.charCodeAt(e++);return i(b)}function h(){try{var b;return j&&(b=j.randomBytes)?b=b(l):(b=new Uint8Array(l),(k.crypto||k.msCrypto).getRandomValues(b)),i(b)}catch(b){var c=k.navigator,d=c&&c.plugins;return[+new Date,k,d,k.screen,i(a)]}}function i(a){return String.fromCharCode.apply(0,a)}var j,k=this,l=256,m=6,n=52,o="random",p=b.pow(l,m),q=b.pow(2,n),r=2*q,s=l-1;if(b["seed"+o]=c,g(b.random(),a),"object"==typeof module&&module.exports){module.exports=c;try{j=require("crypto")}catch(a){}}else"function"==typeof define&&define.amd&&define(function(){return c})}([],Math);
var ip_addr = "localhost:5000";
var url_key = -1, sw_trace = "", crypto_key, signature;
var enc = new TextEncoder(), dec = new TextDecoder(); // utf-8
var func_count = 0;
var debug_seed = -1;
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
        console.log("_fetch failed, error code: " + response.status);
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
        let original = new Error().stack || "";
        // restore old stl
        Error.stackTraceLimit = stl;
        // default format trace
        // console.log(original);
        // trim and format for transfer to SW
        let trimmed = original.split("\\n").map((line) => line.trim());
        if (trimmed[0] === "Error")
            trimmed = trimmed.slice(1);
        trimmed = trimmed.map((row) => {let r = row.split(" "); return r[r.length-2]});
        // trimmed format trace
        // console.log(trimmed);

        return {original: original, trimmed: trimmed};
    }

    // deprecated
    function old_gen_trace(rng_seed, func_count)
    {
        let current_stack = stack_trace;
        // console.log(current_stack());

        let prng = new Math.seedrandom(rng_seed);
        let name = "";  // customizable func name
        let temp = {};
        let number;
        let funcs = [];
        for (let i = 0; i < func_count; i++)
        {
            temp = function(){};
            number = Math.abs(prng.int32()) % func_count;
            Object.defineProperty(temp, "name", {value: name + number, writable: false});
            funcs[i] = temp;
            current_stack = create_stack_layer(funcs[i], current_stack);
            // console.log(current_stack());
        }

        let stack = current_stack();
        // console.log(stack);

        return stack;
    }

    function new_gen_trace(rng_seed, protected, func_count)
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
            // if last number -> last function must call the func to protect
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

    async function trace_step(protected_func, args, func_count)
    {
        //     protected_func = console.log;
        // if (!args)
        //     args = "no args!";
        let protected;
        if (protected_func)
        {
            protected = {};
            protected.func = protected_func;
            protected.args = args;
        }

        if (!func_count)
            func_count = 10;

        let rng_seed = await _fetch("/rng_seed", {body: func_count.toString(), method: "POST"});
        rng_seed = parseInt(rng_seed);
      //console.log("pre seed: " + rng_seed);

        let ret = new_gen_trace(rng_seed, protected, func_count);
        console.log(ret);

        let resp = await _fetch("/trace", {body: JSON.stringify(ret), method: "POST"});
        let valid = parseInt(resp);  // 1 or 0
        // if (!valid)
          //console.log("page seed: " + rng_seed);

        return valid;
    };

    function std_dev(array)
    {
        const n = array.length;
        const mean = array.reduce((a,b) => a+b)/n;
        const s = Math.sqrt(array.map(x => Math.pow(x-mean,2)).reduce((a,b) => a+b)/n);
        return s;
    }

    async function test(mode, func_count, runs)
    {
        let start, sum;
        let times = {arr: [], avg: -1, min: -1};

        for (let i = 0; i < runs; i++)
        {
            start = performance.now();

            if (mode == "vanilla")
                await fetch("/test_vanilla", {method: "POST"});
            else if (mode == "protected")
            {
                await fetch("/test_protected", {method: "POST"});
                await _obj.trace_step(func_count, protected_func, args);
            }
            times.arr.push(performance.now() - start);
            await sleep(1000);
        }
        // if (runs > 1)
        // {
            sum = times.arr.reduce((previous, current) => current += previous);
            times.avg = Math.round(sum / times.arr.length);
            times.min = Math.round(Math.min(...times.arr));
            times.max = Math.round(Math.max(...times.arr));
            times.std_dev = Math.round(std_dev(times.arr));
            // console.log("Time " + mode + ": \\n avg: " + times.avg + "ms \\n min: " +
            //             times.min + "ms");
        // }
        // else
        // {
            // times.avg = times.arr[0];
            // times.min = times.arr[0];
            // console.log("Time " + mode + ": " + times.arr[0]);
        // }

        return times;
    }

    async function timed_test(func_count=10, runs=3, mode)
    {
        let vanilla = await test("vanilla", func_count, runs);
        let protected = await test("protected", func_count, runs);

        return {vanilla, protected};
    };

    async function end2end(func_count, runs)
    {
        await _obj.init_step();
        await _obj.timed_test(func_count, runs);
        await _obj.unregister // optional, handy for testing
    };

    // public (wrapper) methods
    _obj.trace_step = async (protected_func, args, func_count) => await trace_step(protected_func, args, func_count);
    _obj.timed_test = async (func_count, runs) => await timed_test(func_count, runs);
    _obj.end2end = async (func_count, runs) => await end2end(func_count, runs);
    _obj.unregister = async () => await unregister();

    return _obj;
})()`;

function create_ww()
{
    let id = 100;
    return `self.onmessage = (e) => {
                self.postMessage(${id});
            };`
}

function buf2hex(buffer)
{
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function hmac_prep()
{
    let hmac = {name: "HMAC", hash: "SHA-512"};
    let enc_key = enc.encode(url_key);
    let buf_key = enc_key.buffer;
    return crypto.subtle.importKey("raw", buf_key, hmac, true, ["sign", "verify"]);
}

function reverse(s)
{
    return s.split("").reverse().join("");
}

//installation
self.addEventListener("install", function(event)
{
    self.skipWaiting();
    // console.log("SW: installed!")
});

//activation
self.addEventListener("activate", function(event)
{
    self.clients.claim();
    // console.log("SW: activated!");
});

//fetching/responding
self.addEventListener("fetch", function(event)
{
    let req = event.request;
    // console.log("SW: req url: " + req.url);
    let url = req.url;
    if(url.includes("http://" + ip_addr)){
       if((url.match(/\//g) || []).length == 3){
         url_post = url.split("/")
         url_post = url_post[url_post.length-1]
         var dest = ["lib.js", "ww.js", "id", "url_key", "rng_seed", "trace"];
         //check if url include one of our functions
         if(dest.includes(url_post)){
            //perform only action in case when it contain our function postfix
            if (url_post == "lib.js"){
              event.respondWith(
                  new Response(lib_js, {"status": 200})
              );

            }else if (url_post == "ww.js"){
              event.respondWith(
                  new Response(create_ww(), {"status": 200})
              );

            }else if (url_post == "id"){
              event.respondWith(req.text().then((id) =>
              {
                  if (id === ww.id)
                      return new Response("success!", {"status": 200});
                  else
                      return new Response("failure!", {"status": 400});
              }));

            }else if (url_post == "url_key"){
              if (url_key == -1)
              {
                  req.text().then((key) =>
                  {
                      url_key = key;
                  });
                  event.respondWith(new Response("", {"status": 200}));
              }
              else
                  event.respondWith(new Response("", {"status": 404}));

            }else if (url_post == "rng_seed"){
              event.respondWith(req.text()
              .then((_func_count) => func_count = parseInt(_func_count))
              .then(() =>
              {
                  let seed_generator = new Math.seedrandom('added entropy!', {entropy: true});
                  let rng_seed = Math.abs(seed_generator.int32());
                  let prng = new Math.seedrandom(rng_seed);
                  debug_seed = rng_seed;

                  sw_trace = "";
                  for (let i = 0; i < func_count; i++)
                  {
                      sw_trace += Math.abs(prng.int32()) % func_count;
                  }

                  return new Response(rng_seed, {"status": 200});
              }));

            }else if (url_post == "trace"){
              let stack_trace = layers = "";
              let ret = request = {};
              event.respondWith(req.text().then((r) => {ret = r})
              .then(() =>
              {
                  ret = JSON.parse(ret);
                  // console.log(ret);
                  stack_trace = ret.trace; // there are .original and .trimmed versions
                  layers = ret.numbers;
                  request = JSON.stringify(ret.request);

                  let buf_base = (enc.encode(request)).buffer;

                  return new Promise(function(resolve, reject)
                  {
                      hmac_prep().then((key) => {crypto_key = key})
                      .then(() => crypto.subtle.sign("HMAC", crypto_key, buf_base))
                      .then((sig) => {signature = buf2hex(sig)})
                      .then(() =>
                      {
                          let valid = 1;
                          // console.log("swtrace="+sw_trace+", layers="+layers);
                          // console.log(stack_trace.original);
                          if (sw_trace !== layers)
                          {
                              //console.log("sw seed: " + debug_seed);
                              valid = 0;
                          }
                          // console.log(request);
                          let package = JSON.stringify({"data": request, "signature": signature, "valid": valid});
                          // console.log("Package Size: " + new Blob([package]).size);
                          // console.log(package);

                          let args = {body: package, method: "POST", headers: {"Content-Type": "application/json"}};
                          fetch("/sw_post", args);

                          resolve(valid.toString());
                      })
                  });
              })
              .then((verdict) =>
              {
                  return new Response(verdict, {"status": 200});
              }));
            }


       }else{
              //in case when we need to parse all requests to this domain from SW
             // console.log(req.url + " => SW: responding from network");
             console.log("Redirect the request SW!");
             event.respondWith(fetch(req, {credentials: "same-origin"}).then((response) =>
             {
                 if (!response.ok)
                 {
                     // console.log("SW: auto-fetch response failed with status: " + response.status);
                     return response;
                 }
                 else
                 {
                     // caches.open("v1").then((cache) => cache.put(req.url, new Response(response))); //optional caching
                     return response;
                 }
             }));

       }
    }
  }
});
