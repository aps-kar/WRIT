from flask import Flask, render_template, request, send_file
import os
import binascii
import hashlib
import hmac
# import bs4

app = Flask(__name__)

sw_map = {"served": 0}  # sw (service worker)
id_map = {"served": 0, "id": ""}  # sw registration id
key_map = {"served": 0, "key": ""} # server<->sw communication key

@app.route("/")
@app.route("/index")
@app.route("/page.html")
def index():
    return render_template("index.html"), {"Content-Type": "text/html"}

@app.route("/setup")
def setup():
    return render_template("setup.html"), {"Content-Type": "text/html"}

@app.route("/id")
def id():
    if id_map["served"] == 1:    # already served id
        return "", 404

    u = request.args.get("u")
    p = request.args.get("p")
    #TODO: track users and stuff

    temp_id = str(binascii.hexlify(os.urandom(24))) # generate random id
    id = ""
    for i in range(2, len(temp_id) - 1):
        id = id + temp_id[i]
    id_map["id"] = id

    id_map["served"] = 1
    return id_map["id"]

@app.route("/sw.js")
def sw_js():
    req_id = request.args.get("id")

    if id_map["served"] == 0:   # id served
        return "", 404
    elif req_id != id_map["id"]:  # ids not matching
        return "", 404
    elif sw_map["served"] == 1:   # sw served
        return "", 404

    sw_map["served"] = 1
    return render_template("sw.js"), {"Content-Type": "application/javascript"}

@app.route('/key')
def key():
    req_id = request.args.get("id")

    if id_map["served"] == 1 and sw_map["served"] == 1 and req_id == id_map["id"]:
        temp_key = str(binascii.hexlify(os.urandom(24))) # generate random key
        key = ""
        for i in range(2, len(temp_key) - 1):
            key = key + temp_key[i]
        key_map["key"] = key

        key_map["served"] = 1
        return key_map["key"], {"Content-Type": "text/html"}

    return "", 404

@app.route("/trace", methods=["POST"])
def sw_post():
    raw = request.get_data()  # caches the request for multiple body reads
    json = request.get_json()
    page_request = json["data"]
    sw_sig = json["signature"]

    layers_valid = int(json["valid"])
    enc_request = bytearray(str(page_request), encoding="utf-8") # enc request
    enc_key = bytearray(key_map["key"], encoding="utf-8")  # enc key
    # generate signature
    server_sig = hmac.new(enc_key, msg=enc_request, digestmod=hashlib.sha512).hexdigest()

    if server_sig == sw_sig:  # signature match
        if layers_valid:  # trace match
            return "Attestation successful"
        else:  # trace mismatch
            print("trace mismatch")
            return "", 404
    else:  # signature mismatch
        print("sig mismatch")
        return "", 404

@app.route("/setup.js")
def setup_js():
    return render_template("setup.js"), {"Content-Type": "application/javascript"}

@app.route("/helper.js")
def helper_js():
    return render_template("helper.js"), {"Content-Type": "application/javascript"}

@app.route("/seedrandom.js")
def seedrandom_js():
    return render_template("seedrandom.js"), {"Content-Type": "application/javascript"}

@app.route("/axios.js")
def axios_js():
    return render_template("axios.js"), {"Content-Type": "application/javascript"}

@app.route("/axios.map")
def axios_map():
    return render_template("axios.map"), {"Content-Type": "application/javascript"}

@app.route("/style.css")
def style_css():
    return render_template("style.css"), {"Content-Type": "text/css"}

@app.route("/favicon.ico", methods=["POST", "GET"])
def favicon_ico():
    return "", 200

@app.route("/vanilla", methods=["POST"])
def vanilla():
    return "", 200
