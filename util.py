from flask.json import JSONEncoder
from lookaround.panorama import LookaroundPanorama


class CustomJSONEncoder(JSONEncoder):
    def default(self, o):
        if isinstance(o, LookaroundPanorama):
            return {
                "panoid": o.panoid,
                "region_id": o.region_id,
                "lat": o.lat,
                "lon": o.lon,
                "date": o.date
            }
        return super().default(o)
