from flask import Flask, jsonify, render_template, send_file
from flask_cors import CORS
from flask_compress import Compress
from functools import lru_cache
import gc
import io
import mimetypes
from PIL import Image
import pillow_heif
import requests
import sys

sys.path.append("./lookaround")
from lookaround.auth import Authenticator
from lookaround.geo import wgs84_to_tile_coord
from lookaround import get_coverage_tile, get_pano_face

from util import CustomJSONEncoder
from geo import haversine_distance


session = requests.session()

@lru_cache(maxsize=2**16)
def get_coverage_tile_cached(x, y):
    return get_coverage_tile(x, y, session=session)


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.config["COMPRESS_REGISTER"] = False
    compress = Compress()
    compress.init_app(app)

    app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
    app.json_encoder = CustomJSONEncoder
    
    mimetypes.add_type('text/javascript', '.js')
    pillow_heif.register_heif_opener()
    auth = Authenticator()


    @app.route("/")
    def index():
        return render_template('index.html')

    # Coverage tiles are passed through this server because of CORS.
    @app.route("/tiles/coverage/<int:x>/<int:y>/")
    @compress.compressed()
    def relay_coverage_tile(x, y):
        panos = get_coverage_tile_cached(x, y)
        return jsonify(panos)
      
    @app.route("/closest/<float(signed=True):lat>/<float(signed=True):lon>/")
    @compress.compressed()
    def closest_pano_to_coord(lat, lon):
        x, y = wgs84_to_tile_coord(lat, lon, 17)
        panos = get_coverage_tile_cached(x, y)
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

    @app.route("/closestTiles/<float(signed=True):lat>/<float(signed=True):lon>/")
    @compress.compressed()
    def closest_tiles(lat, lon):
        MAX_DISTANCE = 100
        panos = []
        x, y = wgs84_to_tile_coord(lat, lon, 17)
        for i in range(x-1, x+2):
            for j in range (y-1, y+2):
                tile_panos = get_coverage_tile_cached(i, j)
                for pano in tile_panos:
                     distance = haversine_distance(lat, lon, pano.lat, pano.lon)
                     if distance < MAX_DISTANCE:
                        panos.append(pano)
        return jsonify(panos)

    # Panorama faces are passed through this server because of CORS.
    @app.route("/pano/<int:panoid>/<int:region_id>/<int:zoom>/<int:face>/")
    def relay_pano_segment(panoid, region_id, zoom, face):
        heic_bytes = get_pano_face(panoid, region_id, face, zoom, auth, session=session)

        with Image.open(io.BytesIO(heic_bytes)) as image:
            with io.BytesIO() as output:
                image.save(output, format='jpeg', quality=85)
                jpeg_bytes = output.getvalue()
        response = send_file(
            io.BytesIO(jpeg_bytes),
            mimetype='image/jpeg'
        )
        gc.collect()
        return response

    @app.route("/pano/<int:panoid>/<int:region_id>/<int:zoom>/")
    def relay_full_pano(panoid, region_id, zoom):
        heic_array = []
        for i in range(4):
            heic_bytes = get_pano_face(panoid, region_id, i, zoom, auth, session=session)
            with Image.open(io.BytesIO(heic_bytes)) as image:
                heic_array.append(image)

        TILE_SIZE = round(heic_array[0].width * (256 / 5632))
        WIDTH_SIZE = round(heic_array[0].width * (1024 / 5632))
        widths, heights = zip(*(i.size for i in heic_array))
        total_width, max_height = (sum(widths)-WIDTH_SIZE), max(heights)
        heic_pano = Image.new('RGB', (total_width, max_height))
        heic_pano.paste(heic_array[0], (0,0))
        heic_pano.paste(heic_array[1], (heic_array[0].width-TILE_SIZE, 0))
        heic_pano.paste(heic_array[2], ((heic_array[0].width+heic_array[1].width)-(TILE_SIZE*2), 0))
        heic_pano.paste(heic_array[3], ((heic_array[0].width+heic_array[1].width+heic_array[2].width)-(TILE_SIZE*3), 0))
        
        with io.BytesIO() as output:
            heic_pano.save(output, format="jpeg", quality=85)
            jpeg_bytes = output.getvalue()
        response = send_file(
            io.BytesIO(jpeg_bytes),
            mimetype='image/jpeg'
        )
        gc.collect()
        return response     

    return app
