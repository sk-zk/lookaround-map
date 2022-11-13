from functools import lru_cache
import gc
import io

from flask import Blueprint, current_app, jsonify, send_file 
from flask_cors import cross_origin
import numpy as np
from PIL import Image
import requests

from lookaround.auth import Authenticator
from lookaround.geo import wgs84_to_tile_coord, tile_coord_to_wgs84
from lookaround import get_coverage_tile, get_pano_face
import geo


api = Blueprint('api', __name__, url_prefix='/')
session = requests.session()
auth = Authenticator()

@lru_cache(maxsize=2**14)
def get_coverage_tile_cached(x, y):
    return get_coverage_tile(x, y, session=session)
    

# Coverage tiles are passed through this server because of CORS.
@api.route("/tiles/coverage/<int:x>/<int:y>/")
@cross_origin()
def relay_coverage_tile(x, y):
    panos = get_coverage_tile_cached(x, y)
    return jsonify(panos)

@api.route("/closest/<float(signed=True):lat>/<float(signed=True):lon>/")
@cross_origin()
def closest_pano_to_coord(lat, lon):
    x, y = wgs84_to_tile_coord(lat, lon, 17)
    panos = get_coverage_tile_cached(x, y)
    if len(panos) == 0:
        return jsonify(None)

    smallest_distance = 9999999
    closest = None
    for pano in panos:
        distance = geo.distance(lat, lon, pano.lat, pano.lon)
        if distance < smallest_distance:
            smallest_distance = distance
            closest = pano
    return jsonify(closest)

@api.route("/closestTiles/<float(signed=True):lat>/<float(signed=True):lon>/")
@cross_origin()
def closest_tiles(lat, lon):
    MAX_DISTANCE = 100
    panos = []
    for tile in geo.get_circle_tiles(lat, lon, MAX_DISTANCE, 17):
        tile_panos = get_coverage_tile_cached(tile[0], tile[1])
        for pano in tile_panos:
            distance = geo.distance(lat, lon, pano.lat, pano.lon)
            if distance < MAX_DISTANCE:
                panos.append(pano)
    return jsonify(panos)

# Panorama faces are passed through this server because of CORS.
@api.route("/pano/<int:panoid>/<int:region_id>/<int:zoom>/<int:face>/")
@cross_origin()
def relay_pano_segment(panoid, region_id, zoom, face):
    heic_bytes = get_pano_face(
        panoid, region_id, face, zoom, auth, session=session)

    if current_app.config["USE_PYHEIF"]:
        image = pyheif.read(heic_bytes)
        ndarray = np.array(image.data).reshape(
            image.size[1], image.size[0], 3)
        jpeg_bytes = simplejpeg.encode_jpeg(ndarray)
    else:
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

@api.route("/pano/<int:panoid>/<int:region_id>/<int:zoom>/")
def relay_full_pano(panoid, region_id, zoom):
    """
    ! deprecated !
    the viewer doesn't use this, so it hasn't been maintained and will be removed eventually.
    """
    heic_array = []
    for i in range(4):
        heic_bytes = get_pano_face(
            panoid, region_id, i, zoom, auth, session=session)
        with Image.open(io.BytesIO(heic_bytes)) as image:
            heic_array.append(image)

    TILE_SIZE = round(heic_array[0].width * (256 / 5632))
    WIDTH_SIZE = round(heic_array[0].width * (1024 / 5632))
    widths, heights = zip(*(i.size for i in heic_array))
    total_width, max_height = (sum(widths)-WIDTH_SIZE), max(heights)
    heic_pano = Image.new('RGB', (total_width, max_height))
    heic_pano.paste(heic_array[0], (0, 0))
    heic_pano.paste(heic_array[1], (heic_array[0].width-TILE_SIZE, 0))
    heic_pano.paste(
        heic_array[2], ((heic_array[0].width+heic_array[1].width)-(TILE_SIZE*2), 0))
    heic_pano.paste(heic_array[3], ((
        heic_array[0].width+heic_array[1].width+heic_array[2].width)-(TILE_SIZE*3), 0))

    with io.BytesIO() as output:
        heic_pano.save(output, format="jpeg", quality=85)
        jpeg_bytes = output.getvalue()
    response = send_file(
        io.BytesIO(jpeg_bytes),
        mimetype='image/jpeg'
    )
    gc.collect()
    return response
