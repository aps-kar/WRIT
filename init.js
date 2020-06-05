async function test_new_trace(func_number, msg)
{
    window.WRIT.trace_step((msg_body) => {
        let path = "/WRIT/url_key.txt";
        let options = {method: 'POST', body: msg_body};
        let req = {path, options};
        // console.log("This is a valid request object: ");
        // console.log(new Request(req.path, req.options));
        return req;
    }, msg, func_number);
}

async function post_text()
{
    let tx = document.getElementById("tx");
    let resp = await fetch("/WRIT/txt_post", {body: JSON.stringify({"val": tx.value}), method: "POST", headers: {"Content-Type": "application/json"}});
    tx.value = await resp.text();
}

function ww()
{
    let ww = new Worker("ww.js");
    ww.onmessage = (e) => {
        console.log("id " + e.data);
    };
    ww.postMessage("give me the id");
}

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
