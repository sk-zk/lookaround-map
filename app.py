from flask import Flask, jsonify, render_template, send_file
import io
import math
import mimetypes
from PIL import Image
import pillow_heif
import requests
import sys

sys.path.append("./lookaround")
from lookaround.auth import Authenticator
from lookaround.geo import wgs84_to_tile_coord
from lookaround import get_coverage_tile, fetch_pano_segment

from util import CustomJSONEncoder


def haversine_distance(lat1, lon1, lat2, lon2):
    # via https://www.movable-type.co.uk/scripts/latlong.html
    # MIT
    R = 6371e3
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    delta_phi = (lat2-lat1) * math.pi / 180
    delta_lambda = (lon2-lon1) * math.pi / 180
    a = math.sin(delta_phi/2) * math.sin(delta_phi/2) + \
          math.cos(phi1) * math.cos(phi2) * \
          math.sin(delta_lambda/2) * math.sin(delta_lambda/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c;


def create_app():
    app = Flask(__name__)

    app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
    app.json_encoder = CustomJSONEncoder
    
    mimetypes.add_type('text/javascript', '.js')
    pillow_heif.register_heif_opener()
    auth = Authenticator()

    @app.route("/")
    def index():
        return render_template('index.html')

    # Coverage tiles are passed through this server because of CORS
    @app.route("/tiles/coverage/<int:x>/<int:y>/")
    def relay_coverage_tile(x, y):
        panos = get_coverage_tile(x, y)
        return jsonify(panos)

    # TODO: Port the auth code to JS so the client can request tiles directly
    @app.route("/tiles/road/<tint>/<int:z>/<int:x>/<int:y>/")
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
    
    @app.route("/closest/<float:lat>/<float:lon>/")
    def closest_pano_to_coord(lat, lon):
        x, y = wgs84_to_tile_coord(lat, lon, 17)
        panos = get_coverage_tile(x, y)
        if len(panos) == 0:
            return jsonify(None)

        smallest_distance = 9999999
        closest = None
        for pano in panos:
            distance = haversine_distance(lat, lon, pano.lat, pano.lon)
            if distance < smallest_distance:
                smallest_distance = distance
                closest = pano
        return jsonify(closest)

    @app.route("/pano/<int:panoid>/<int:region_id>/<int:segment>/<int:zoom>/")
    def relay_pano_segment(panoid, region_id, segment, zoom):
        heic_bytes = fetch_pano_segment(panoid, region_id, segment, zoom, auth)
        with Image.open(io.BytesIO(heic_bytes)) as image:
            with io.BytesIO() as output:
                image.save(output, format='jpeg')
                jpeg_bytes = output.getvalue()
        return send_file(
            io.BytesIO(jpeg_bytes),
            mimetype='image/jpeg'
        )

    return app
