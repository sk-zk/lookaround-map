from flask import Flask, jsonify, render_template, send_file
import io
import mimetypes
import requests
import sys

sys.path.append("./lookaround")
from lookaround.auth import Authenticator
from lookaround import get_coverage_tile

from util import CustomJSONEncoder


def create_app():
    app = Flask(__name__)

    app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
    app.json_encoder = CustomJSONEncoder
    
    mimetypes.add_type('text/javascript', '.js')

    auth = Authenticator()

    @app.route("/")
    def index():
        return render_template('index.html')

    # Coverage tiles are passed through this server because of CORS
    @app.route("/tiles/coverage/<int:x>/<int:y>")
    def relay_coverage_tile(x, y):
        panos = get_coverage_tile(x, y)
        return jsonify(panos)

    # Map tiles are passed through this server because I currently don't feel like
    # translating the auth code to JS
    @app.route("/tiles/road/<tint>/<int:z>/<int:x>/<int:y>")
    def relay_road_tile(tint, z, x, y):
        if tint == "l":
            tint_param = "light"
        elif tint == "d":
            tint_param = "dark"
        else:
            tint_param = "light"
        url = auth.authenticate_url(
            f"https://cdn3.apple-mapkit.com/ti/tile?style=0&size=1&x={x}&y={y}&z={z}&scale=1&lang=en"
            f"&poi=1&tint={tint_param}&emphasis=standard")
        response = requests.get(url)
        return send_file(
            io.BytesIO(response.content),
            mimetype='image/png'
        )

    return app
