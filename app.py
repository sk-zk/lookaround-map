import sys
import mimetypes

from flask import Flask, render_template, request, redirect, send_from_directory
from flask_cors import CORS
from flask_compress import Compress

import pillow_heif

sys.path.append("lookaround")

from routes.api import api
from config import config
from misc.util import load_ip_blacklist
from limiter import limiter


def create_app():
    ip_blacklist = load_ip_blacklist()

    app = Flask(__name__)
    CORS(app, resources={r"/static/*": {"origins": "*"}})

    app.config["COMPRESS_MIMETYPES"] = [
        'text/html',
        'text/css',
        'text/xml',
        'application/json',
        'application/javascript'
    ]
    compress = Compress()
    compress.init_app(app)

    app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
    
    mimetypes.add_type('text/javascript', '.js')
    pillow_heif.register_heif_opener()

    limiter.init_app(app)

    app.register_blueprint(api)

    @app.route("/")
    def index():
        return render_template('index.html')

    @app.route("/apple-touch-icon.png")
    def apple_touch_icon():
        return send_from_directory("static/favicons", "apple-touch-icon.png")
    
    @app.route("/favicon.ico")
    def favicon():
        return send_from_directory("static/favicons", "favicon.png")

    @app.before_request
    def you_know_what_you_did():
        ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)     
        if ip in ip_blacklist:
            return redirect(config.IP_BLACKLIST_REDIRECT_URL)

    return app
