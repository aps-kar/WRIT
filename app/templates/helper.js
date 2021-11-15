function array_avg(array)
{
    return array.reduce((a, b) => a + b, 0) / array.length;
}
async function _fetch(...args) // custom fetch
{
    let response = await fetch(...args); // , {credentials: "same-origin"}
    if (response.ok)
    {
        let txt = await response.text();
        return txt;
    }
}
function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function test_writ(e, runs, funcs)
{
    let beg, end;
    let e2e = [];
    window.seed_time = [];
    window.gen_time = [];
    window.prep_time = [];
    window.send_time = [];
    for (let i = 0; i < (runs || 999); i++)
    {
        console.log(i);
        beg = performance.now();
        await WRIT.post(create_request, 1, e, funcs || 20);
        end = performance.now();
        e2e.push(end-beg);
        window.prep_time.push(parseFloat(await (await fetch("/prep_time")).text()));
        window.send_time.push(parseFloat(await (await fetch("/send_time")).text()));
        console.log("e2e avg: " + array_avg(e2e));
        await sleep(500);
    }
    console.log("seed_time avg: " + array_avg(window.seed_time));
    console.log("gen_time avg: " + array_avg(window.gen_time));
    console.log("prep_time avg: " + array_avg(window.prep_time));
    console.log("send_time avg: " + array_avg(window.send_time));
    console.log("e2e avg: " + array_avg(e2e));
}

async function test_vanilla(runs)
{
    let beg, end;
    let req = create_request(2);
    window.van = [];

    for (let i = 0; i < (runs || 999); i++)
    {
        console.log(i);
        beg = performance.now();
        await fetch(req.path, req.config);
        end = performance.now();
        window.van.push(end-beg);
        console.log("van avg: " + array_avg(window.van));
        await sleep(500);
    }

    console.log("vanilla takes " + array_avg(window.van));
}

// async function test_new_trace(e, func_number, msg)
// {
//     // console.log(e);
//     let valid = await window.WRIT.trace_step((msg_body) => {
//         let path = "favicon.ico";
//         let options = {method: 'POST', body: msg_body};
//         let req = {path, options};
//         // console.log("This is a valid request object: ");
//         // console.log(new Request(req.path, req.options));
//         return req;
//     }, e, msg, func_number);
//     console.log(valid);
// }

// async function trace_step(protected_func, e, args, func_count)
// {
//     // check if the associated event was triggered manually
//     if (e && e.isTrusted === false)
//         return new Error("Artificial event fired!");
//     // number of function layers to add onto the stack trace
//     let func_count = (func_count || 10).toString();
//     // get a new seed from the SW for the random function generation
//     let rng_seed = await fetch("/rng_seed", {body: func_count, method: "POST"});
//     // i. run the page's protected function (protected_func)
//     // ii. save the request it generates & capture its stack trace
//     // iii. add a series of randomly generated functions to the trace
//     let trace = generate_trace(rng_seed, protected_func, func_count);
//     // forward the final stack trace and the page's request to the SW
//     return await fetch("/trace", {body: JSON.stringify(trace), method: "POST"});
// }

// async function post_text()
// {
//     let tx = document.getElementById("tx");
//     let resp = await fetch("/txt_post", {body: JSON.stringify({"val": tx.value}), method: "POST", headers: {"Content-Type": "application/json"}});
//     tx.value = await resp.text();
// }

// function ww()
// {
//     let ww = new Worker("ww.js");
//     ww.onmessage = (e) => {
//         console.log("id " + e.data);
//     };
//     ww.postMessage("give me the id");
// }

// (async function()
// {
    // await lib_obj.init_step();
    // await lib_obj.trace_step(10);
    // await lib_obj.unregister();
    // await lib_obj.end2end(10, 1);
    // console.log(lib_obj);
// })();

// let test = document.getElementById("test");
// let old = test.dispatchEvent;
// console.log("2: " + old)
// test.dispatchEvent = (...args) =>
// {
//     // await lib_obj.trace_step();
//     alert("hello?");
//     lib_obj.trace_step();
//     old(...args);
// }
// console.log("3: " + test.dispatchEvent)
