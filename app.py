from flask import Flask, render_template, request, redirect
from flask_cors import CORS
from flask_compress import Compress
import mimetypes
import pillow_heif
import sys

sys.path.append("lookaround")

from routes.api import api
from misc.CustomJSONEncoder import CustomJSONEncoder

ip_blacklist = []
with open("config/blacklist.txt", "r") as f:
    for line in f.readlines():
        line = line.strip()
        if not line.startswith("#"):
            ip_blacklist.append(line)
print(ip_blacklist)

def create_app():
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
    app.json_encoder = CustomJSONEncoder
    
    mimetypes.add_type('text/javascript', '.js')
    pillow_heif.register_heif_opener()

    app.register_blueprint(api)

    @app.route("/")
    def index():
        return render_template('index.html')

    @app.before_request
    def you_know_what_you_did():
        ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
        if ip in ip_blacklist:
            return redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    return app
