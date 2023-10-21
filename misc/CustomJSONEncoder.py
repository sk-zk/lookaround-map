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
                "buildId": str(o.build_id),
                "lat": o.lat,
                "lon": o.lon,
                "timestamp": o.timestamp,
                "timezone": tf.timezone_at(lat=o.lat, lng=o.lon),
                "heading": o.heading,
                "coverageType": o.coverage_type,
                "elevation": o.elevation,
                "lensProjection": { 
                    "fovH": o.camera_metadata[0].lens_projection.fov_h,
                    "cy": o.camera_metadata[0].lens_projection.cy
                    },
            }
        return super().default(o)
