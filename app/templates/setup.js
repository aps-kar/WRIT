function create_request(num)
{
    let text = document.getElementById("tx" + num).value;
    let config = {method: "POST", body: text};
    return {path: "/favicon.ico", config};
}

function get_cookie(cname)
{
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
          return c.substring(name.length, c.length);
        }
    }
    return "";
}

function del_cookies()
{
    var allCookies = document.cookie.split(";");
    for (var i = 0; i < allCookies.length; i++)
        document.cookie = allCookies[i] + "=;expires="
                            + new Date(0).toUTCString();
}

async function _fetch(...args) // lightly modified fetch
{
    let response = await fetch(...args); // , {credentials: "same-origin"}
    if (response.ok)
    {
        let txt = await response.text(); // resolve response as text
        return txt;
    }
}

async function register_sw(id) // fetch SW script and register it
{
    if ("serviceWorker" in navigator) // if sw supported in browser
    {
        // register sw
        let reg = await navigator.serviceWorker.register("sw.js?id=" + id);

        if (reg)
            return reg;
    }

    // SW API unsupported in current browser
    return null;
}

function sw_activation() // wait for SW to activate
{
    return new Promise((resolve, reject) =>
    {
        if (navigator.serviceWorker.controller) // if sw activated
            resolve();
        else // listen for activation
            navigator.serviceWorker.oncontrollerchange = (cc) => resolve();
    });
}

async function setup(u, p) // execute setup phase
{
    let id = await _fetch("/id?u=" + u + "&p=" + p); // get id from server
    document.cookie = u + "=" + id + ";expires="
        + new Date().setTime(new Date().getTime() + 365*24*60*60*1000);
    let reg = await register_sw(id); // register sw with id

    if (reg) // if registration was successful
    {
        await sw_activation();  // wait for sw to activate
        // give id to sw
        let config = {method: "POST", body: JSON.stringify({"id": id}),
                    headers: {"Content-Type": "application/json"}};
        await _fetch("/key", config);
    }

    // setup phase failed
    return null;
}

async function get_sw() // get registered sw for current scope
{
    let sw = await navigator.serviceWorker.getRegistration();
    if (sw && sw.active.state !== "activated")
        await sw_activation();

    return sw;
}

async function get_lib()
{
    if (!window.WRIT)   // if WRIT isn't installed yet
    {
        let lib_string = await _fetch("/lib.js");  // get WRIT's lib from sw
        let lib_js;
        // try {
            // lib_js = eval(lib_string); // eval the string to get JS
        // }
        // catch (err) {
            // console.log(err);
        // }
        // finally {
            // alternative that doesn't use eval (sometimes needed for Safari and Opera)
            lib_js = (new Function("return " + lib_string))();
        // }

        return lib_js;
    }
    else // if WRIT is installed already, there should be a WRIT property
        return window.WRIT;
}

// elegant integration with axios, alternative to directly editing source
// currently unused
async function axios_integration()
{
    // request interceptor
    window.axios.interceptors.request.use(async function axios_intercept(config)
    {
        let valid = await window.WRIT.trace_step();
        if (!valid)
            throw new Error("SW attestation failed");

        return config;
    },
    function (error)
    {
        return Promise.reject(error);
    });
}

async function init(u, p) // WRIT initialization
{
    let sw = await get_sw(); // get the operating sw if it exists

    if (!sw) // if it doesn't, install it first
        await setup(u, p);

    // let lib = await get_lib();
    // return lib;
}
