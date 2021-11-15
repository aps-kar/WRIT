from flask import Flask, render_template, request
import os
import binascii
import hashlib
import hmac
from pprint import pprint as pp

app = Flask(__name__)

class User:
    def __init__(self, uname, pword, id, key, sw):
        self.uname = uname;
        self.pword = pword;
        self.id = id;
        self.key = key;
        self.sw = sw;

users = {}

@app.route("/")
@app.route("/index")
@app.route("/page.html")
def index():
    token_id = str(binascii.hexlify(os.urandom(24))) # generate random token id
    token_id = token_id[2:-1]
    return render_template("index.html", tid=token_id), {"Content-Type": "text/html"}

@app.route("/setup")
def setup():
    return render_template("setup.html"), {"Content-Type": "text/html"}

@app.route("/id")
def id():
    uname = request.args.get("u")
    for usr in users:
        if usr.uname == uname:  # already served id for this user
            return "", 404

    pword = request.args.get("p")
    id = str(binascii.hexlify(os.urandom(24))) # generate random id
    id = id[2:-1]
    users[id] = User(uname, pword, id, "", 0)

    return id, {"Content-Type": "text/html"}

@app.route("/sw.js")
def sw_js():
    id = request.args.get("id")

    if id in users and users[id].sw == 0:
        users[id].sw = 1;
    else:
        return "", 404

    return render_template("sw.js"), {"Content-Type": "application/javascript"}

@app.route('/key', methods=["POST"])
def key():
    json = request.get_json()
    id = json["id"]
    if id in users and users[id].sw == 1 and users[id].key == "":
        key = str(binascii.hexlify(os.urandom(24))) # generate random key
        key = key[2:-1]
        users[id].key = key
    else:
        return "", 404

    return key, {"Content-Type": "text/html"}

@app.route("/trace", methods=["POST"])
def sw_post():
    raw = request.get_data()  # caches the request for multiple body reads
    json = request.get_json()
    page_request = json["data"]
    sw_sig = json["signature"]
    id = json["id"]
    layers_valid = int(json["valid"])
    enc_request = bytearray(str(page_request), encoding="utf-8") # enc request
    enc_key = bytearray(users[id].key, encoding="utf-8")  # enc key
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

@app.route("/jsOTP.min.js")
def jsOTP_min_js():
    return render_template("jsOTP.min.js"), {"Content-Type": "application/javascript"}

@app.route("/base32.min.js")
def base32_min_js():
    return render_template("base32.min.js"), {"Content-Type": "application/javascript"}

# @app.route("/sw_ad.js")
# def sw_ad_js():
#     # return render_template("sw_ad.js"), {"Content-Type": "application/javascript"}
#     return "", 404

# @app.route("/bg")
# @app.route("/cs")
# def extest():
#     return "ok", 200
