export function parseHashParams() {
    const params = new URLSearchParams(window.location.hash.substring(1));

    let center = null;
    if (params.has("c")) {
        const centerParams = params.get("c").split("/");
        center = { zoom: centerParams[0], latitude: centerParams[1], longitude: centerParams[2] };
    } else {
        center = { zoom: 3, latitude: 20, longitude: 0 };
    }

    let pano = null;
    if (params.has("p")) {
        const panoParams = params.get("p").split("/");
        pano = { latitude: panoParams[0], longitude: panoParams[1] };
    }

    return {
        "center": center,
        "pano": pano
    };
}
