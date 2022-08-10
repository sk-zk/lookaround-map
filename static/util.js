export function parseAnchorParams() {
    const params = new URLSearchParams(window.location.hash.substring(1));

    const center = params.has("c") // center
        ? params.get("c").split("/")
        : [3, 20, 0]; // zoom, lat, lon

    const startPano = params.has("p") // panoid
        ? params.get("p").split("/")
        : null;

    return {
        "center": center,
        "startPano": startPano
    };
}
