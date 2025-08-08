from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

_storage_uri = "memory://"

limiter = Limiter(
    get_remote_address,
    storage_uri=_storage_uri,
    storage_options={"socket_connect_timeout": 30},
    strategy="fixed-window",
    meta_limits=["2/day"],
)
