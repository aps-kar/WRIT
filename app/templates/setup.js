(async function setup_js()
{
    // private methods
    async function _fetch(...args) // custom fetch
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

    async function setup() // execute setup phase
    {
        let id = await _fetch("/id"); // get id from server
        let reg = await register_sw(id); // register sw with id
        if (reg) // if registration was successful
        {
            await sw_activation();  // wait for sw to activate
            // give id to sw
            await _fetch("/key?id=" + id);
        }

        // setup phase failed
        return null;
    }

    async function get_sw() // get registered sw for current scope
    {
        return await navigator.serviceWorker.getRegistration();
    }

    async function get_lib()
    {
        if (!window.WRIT)   // if WRIT isn't installed yet
        {
            let lib_string = await _fetch("/lib.js");  // get WRIT's lib from sw
            let lib_js = eval(lib_string); // eval the string to get JS

            // alternative that doesn't use eval (we need eval for MacOS)
            // let lib_js = (new Function("return " + await _fetch("/lib.js")))();

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

    async function init() // WRIT initialization
    {
        let sw = await get_sw(); // get the operating sw if it exists
        if (!sw) // if it doesn't, install it first
            await setup();
        // else
        //     await sw_activation();

        return get_lib();
    }

    window.WRIT = await init();
    // await axios_integration(); // if not directly editing Axios' source
})();
