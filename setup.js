(async function setup_js()
{
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

    async function register_sw(url_key) // fetch SW script and register it
    {
        if ("serviceWorker" in navigator)
        {
            let reg = await navigator.serviceWorker.register('sw.js');
            // ?url_key=" + url_key);

            if (reg)
                return reg;

            // console.log("SW registration failed");
        }
        else
            // console.log("SW API unsupported in current browser");

        return null;
    }

    function sw_activation() // wait for SW to activate...
    {
        return new Promise((resolve, reject) =>
        {
            if (navigator.serviceWorker.controller)
                resolve();
            else
                navigator.serviceWorker.oncontrollerchange = (cc) => resolve();
        });
    }

    async function setup() // execute setup phase
    {
        // let url_key = await _fetch("/WRIT/url_key");
        let reg = await register_sw(); // url_key);
        if (reg)
        {
            await sw_activation();
            // await _fetch("/url_key", {body: url_key, method: "POST"});
        }
        else
            console.log("Setup phase failed")
    }

    async function get_sw()
    {
        return await navigator.serviceWorker.getRegistration();
    }

    async function get_lib()
    {
        if (!window.WRIT)
        {
            // let lib_js = (new Function("return " + await _fetch("/lib.js")))();
            // let lib_js = await _fetch("/lib.js");
            // let writ = eval(lib_js);
            // return writ;
            await fetch("lib.js");
        }
        // else
            // return window.WRIT;
    }

    async function axios_integration()
    {
        // Add a request interceptor
        window.axios.interceptors.request.use(async function axios_intercept(config)
        {
            // Do something before request is sent
            // console.log(config);
            let valid = await window.WRIT.trace_step();
            if (!valid)
                throw new Error("SW attestation failed");

            return config;
        },
        function (error) {
            // Do something with request error
            return Promise.reject(error);
        });
    }

    async function init() // initialization
    {
        let sw = await get_sw();
        if (!sw)
            await setup();
            // console.log("SW not installed, running setup");
        // else
        // {
        //     console.log("SW installed, no need to run setup");
        // }

        // console.log("Setup complete, fetching lib");
        else
            await sw_activation();

        // return
        // await get_lib();
    }

    await init();
    // window.WRIT = await init();
    // await axios_integration();
})();
