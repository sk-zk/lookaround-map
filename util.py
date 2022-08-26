from flask.json import JSONEncoder
from lookaround.panorama import LookaroundPanorama


class CustomJSONEncoder(JSONEncoder):
    def default(self, o):
        if isinstance(o, LookaroundPanorama):
            return {
                "panoid": str(o.panoid),
                "region_id": str(o.region_id),
                "lat": o.lat,
                "lon": o.lon,
                "date": o.date,
                "north": o.north,
                "coverageType": o.coverage_type,
            }
        return super().default(o)
