import math
from pyproj import CRS, Geod
import json
from typing import List
from bs4 import BeautifulSoup
import requests
from requests import Session
import lxml
import cchardet

from lookaround.geo import wgs84_to_tile_coord
from .geocode import reverse_geocode

geod = CRS("epsg:4326").get_geod()


def distance(lat1, lon1, lat2, lon2):
    return geod.line_length([lon1, lon2], [lat1, lat2])


def move(lat, lon, azimuth, distance):
    lons, lats, back_azimuths = geod.fwd([lon], [lat], azimuth, distance)
    return lats[0], lons[0]


def get_circle_tiles(center_lat, center_lon, radius, zoom):
    """
    Returns the coordinates of the map tiles which cover a circular area around a point.
    """
    north, east, south, west = [move(center_lat, center_lon, x, radius) for x in [0, 90, 180, 270]]
    lat_min = north[0]
    lat_max = south[0]
    lon_min = west[1]
    lon_max = east[1]
    bbox_min = wgs84_to_tile_coord(lat_min, lon_min, zoom)
    bbox_max = wgs84_to_tile_coord(lat_max, lon_max, zoom)
    tiles = []
    for x in range(bbox_min[0], bbox_max[0] + 1):
        for y in range(bbox_min[1], bbox_max[1] + 1):
            # TODO filter out tiles that aren't actually inside the circle.
            # This turned out to be trickier than I expected
            tiles.append((x, y))
    return tiles
