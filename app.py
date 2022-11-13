from flask import Flask, render_template
from flask_cors import CORS
from flask_compress import Compress
import importlib
import mimetypes
import pillow_heif
import sys

sys.path.append("lookaround")

from api import api
from util import CustomJSONEncoder


def is_pyheif_installed():
    pyheif = importlib.util.find_spec("pyheif")
    return pyheif is not None

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

    app.config["USE_PYHEIF"] = is_pyheif_installed()
    if app.config["USE_PYHEIF"]:
        print("pyheif enabled")
        import pyheif
        import simplejpeg
        import numpy as np

    app.register_blueprint(api)

    @app.route("/")
    def index():
        return render_template('index.html')

    return app
