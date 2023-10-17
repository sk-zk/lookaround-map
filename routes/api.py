from functools import lru_cache
import gc
import importlib
import io
import math

from flask import Blueprint, abort, jsonify, request, send_file
from flask_cors import cross_origin
import numpy as np
from PIL import Image
import requests
from requests import HTTPError

from lookaround.auth import Authenticator
from lookaround import get_coverage_tile, get_pano_face
import geo
from config import config


def is_package_installed(package_name):
    package = importlib.util.find_spec(package_name)
    return package is not None


# I've decided to remove the cache for `relay_coverage_tile` completely
# because, for god knows what reason, it slowed down the `closest` endpoint
# quite a bit, even though it never interacted with the map tile cache in any way.
# top 10 questions scientists still can't answer.
@lru_cache(maxsize=2**6)
def get_coverage_tile__cached_for_movement(x, y):
    return get_coverage_tile(x, y, session=movement_session)


api = Blueprint('api', __name__, url_prefix='/')
pano_session = requests.session()
movement_session = requests.session()
map_session = requests.session()
addr_session = requests.session()
auth = Authenticator()


use_heic2rgb = is_package_installed("heic2rgb")
if use_heic2rgb:
    print("heic2rgb enabled")
    import heic2rgb
    import simplejpeg
else:
    use_pyheif = is_package_installed("pyheif")
    if use_pyheif:
        print("pyheif enabled")
        import pyheif
        import simplejpeg


# Coverage tiles are passed through this server because of CORS.
@api.route("/tiles/coverage/<int:x>/<int:y>/")
@cross_origin()
def relay_coverage_tile(x, y):
    panos = get_coverage_tile(x, y, session=map_session)
    return jsonify(panos)


@api.route("/closest")
@cross_origin()
def closest():
    """
    Retrieves the closest panoramas to a given point from the Look Around API.
    The returned panoramas are sorted by distance to this point.
    """
    # parse params
    lat = request.args.get("lat", default=None, type=float)
    lon = request.args.get("lon", default=None, type=float)
    radius = request.args.get("radius", default=config.CLOSEST_MAX_RADIUS, type=float)
    limit = request.args.get("limit", default=None, type=int)

    if not lat or not lon:
        abort(400, "Latitude and longitude must be set")
    if math.isnan(lat) or math.isnan(lon) or math.isnan(radius):
        abort(400)
    if radius > config.CLOSEST_MAX_RADIUS:
        radius = config.CLOSEST_MAX_RADIUS
    if limit and limit < 1:
        limit = 1

    # fetch panos and sort
    panos = []
    tiles = geo.get_circle_tiles(lat, lon, radius, 17)
    for (x, y) in tiles:
        tile_panos = get_coverage_tile__cached_for_movement(x, y)
        for pano in tile_panos:
            distance = geo.distance(lat, lon, pano.lat, pano.lon)
            if distance < radius:
                panos.append((pano, distance))
    panos = sorted(panos, key=lambda p: p[1])
    if limit:
        return jsonify([x[0] for x in panos[:limit]])
    else:
        return jsonify([x[0] for x in panos])


@api.route("/address")
def address():
    lat = request.args.get("lat", default=None, type=float)
    lon = request.args.get("lon", default=None, type=float)
    language = request.args.get("lang", default="en-US", type=str)
    if not lat or not lon:
        abort(400, "Latitude and longitude must be set")
    if math.isnan(lat) or math.isnan(lon):
        abort(400)
    
    try:
        address = geo.reverse_geocode(lat, lon, language=language, session=addr_session)
        return jsonify(address)
    except AttributeError:
        return jsonify([])


# Panorama faces are passed through this server because of CORS.
@api.route("/pano/<int:panoid>/<int:batch_id>/<int:zoom>/<int:face>/")
@cross_origin()
def relay_pano_face(panoid, batch_id, zoom, face):
    try:
        heic_bytes = get_pano_face(panoid, batch_id, face, zoom, auth, session=pano_session)
    except ValueError:
        abort(400)
    except HTTPError as httpError:
        abort(httpError.response.status_code)

    if use_heic2rgb:
        image = heic2rgb.decode(heic_bytes)
        ndarray = np.frombuffer(image.data, dtype=np.uint8).reshape(
            image.height, image.width, 3)
        jpeg_bytes = simplejpeg.encode_jpeg(ndarray, config.JPEG_QUALITY)
    elif use_pyheif:
        image = pyheif.read(heic_bytes)
        ndarray = np.array(image.data).reshape(
            image.size[1], image.size[0], 3)
        jpeg_bytes = simplejpeg.encode_jpeg(ndarray, config.JPEG_QUALITY)
    else:
        with Image.open(io.BytesIO(heic_bytes)) as image:
            with io.BytesIO() as output:
                image.save(output, format='jpeg', quality=config.JPEG_QUALITY)
                jpeg_bytes = output.getvalue()
    response = send_file(
        io.BytesIO(jpeg_bytes),
        mimetype='image/jpeg'
    )
    gc.collect()
    return response


@api.route("/pano/<int:panoid>/<int:batch_id>/<int:zoom>/")
def relay_full_pano(panoid, batch_id, zoom):
    """
    ! deprecated !
    the viewer doesn't use this, so it hasn't been maintained and will be removed eventually.
    """
    heic_array = []
    for i in range(4):
        heic_bytes = get_pano_face(
            panoid, batch_id, i, zoom, auth, session=pano_session)
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
        heic_pano.save(output, format="jpeg", quality=config.JPEG_QUALITY)
        jpeg_bytes = output.getvalue()
    response = send_file(
        io.BytesIO(jpeg_bytes),
        mimetype='image/jpeg'
    )
    gc.collect()
    return response
