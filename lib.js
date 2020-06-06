(function lib_js()
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

        ret.trace.original.split("\n").forEach(e => console.log(e));

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

        let rng_seed = await _fetch("/WRIT/rng_seed", {body: func_count.toString(), method: "POST"});
        rng_seed = parseInt(rng_seed);
      //console.log("pre seed: " + rng_seed);

        let ret = new_gen_trace(rng_seed, protected, func_count);
        console.log(ret);

        let resp = await _fetch("/WRIT/trace", {body: JSON.stringify(ret), method: "POST"});
        let valid = parseInt(resp);  // 1 or 0
        let tx = document.getElementById("tx");
        if (!valid)
            tx.value += "error\\n";
        else
            tx.value += "well done\\n";

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

    window.WRIT = _obj;
})();
