import math

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
