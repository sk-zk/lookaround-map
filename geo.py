import math
from pyproj import CRS, Geod

geod = CRS("epsg:4326").get_geod()


def distance(lat1, lon1, lat2, lon2):
    return geod.line_length([lon1, lon2], [lat1, lat2])


def move(lat, lon, azimuth, distance):
    lons, lats, back_azimuths = geod.fwd([lon], [lat], azimuth, distance)
    return lats[0], lons[0]
