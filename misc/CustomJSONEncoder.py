from flask.json import JSONEncoder
from timezonefinder import TimezoneFinder
from lookaround.panorama import LookaroundPanorama

# Must be initialized outside the class because the encoder class doesn't
# get reused, apparently.
# further, `in_memory` must be set to True because the library would otherwise
# trip over its own feet trying to open the same file in different threads.
tf = TimezoneFinder(in_memory=True) 


class CustomJSONEncoder(JSONEncoder):
    def default(self, o):
        if isinstance(o, LookaroundPanorama):
            return {
                "panoid": str(o.panoid),
                "regionId": str(o.region_id),
                "lat": o.lat,
                "lon": o.lon,
                "timestamp": o.timestamp,
                "timezone": tf.timezone_at(lat=o.lat, lng=o.lon),
                "heading": o.heading,
                "coverageType": o.coverage_type,
                "rawElevation": o.raw_elevation,
                "projection": { 
                    "latitudeSize": o.projection[0].unknown24.latitude_size,
                    "unknown34": o.projection[0].unknown24.unknown34
                    }
            }
        return super().default(o)
