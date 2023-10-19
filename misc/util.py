from config import config


def load_ip_blacklist() -> set:
    ip_blacklist = set()
    with open(config.IP_BLACKLIST_PATH, "r") as f:
        for line in f.readlines():
            line = line.strip()
            if not line.startswith("#") and line != "":
                ip_blacklist.add(line)
    return ip_blacklist


def to_bool(s: str) -> bool:
    s = s.lower()
    return s == "1" or s == "true" or s == "True"
