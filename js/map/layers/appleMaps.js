L.TileLayer.AppleMapsTiles = L.TileLayer.extend({
    initialize: function (auth, opts) {
      this.auth = auth;
      L.setOptions(this, opts);
    },
    createTile: function (coords, done) {
      var tile = document.createElement("img");
      tile.alt = "";
  
      L.DomEvent.on(tile, "load", L.Util.bind(this._tileOnLoad, this, done, tile));
          L.DomEvent.on(tile, "error", L.Util.bind(this._tileOnError, this, done, tile));
  
      let url = "";
      switch (this.options.type) {
        default:
        case "road":
          url = `https://cdn3.apple-mapkit.com/ti/tile?` +
          `style=0&size=1&x=${coords.x}&y=${coords.y}&z=${coords.z}&v=2210195&scale=1` +
          `&lang=en&poi=1&tint=${this.options.tint}&emphasis=standard`;
          break;
        case "satellite":
          url = `https://sat-cdn1.apple-mapkit.com/tile?` +
                `style=7&size=1&scale=1&x=${coords.x}&y=${coords.y}&z=${coords.z}&v=2210195`;
          break;
        case "satellite-overlay":
          url = `https://cdn1.apple-mapkit.com/ti/tile?` +
                `style=46&size=1&x=${coords.x}&y=${coords.y}&z=${coords.z}&scale=1&poi=0`;
          break;
      }
  
      this.auth.authenticateUrl(url)
        .then((url) => { tile.src = url; });
      done(null, tile);
      return tile;
    }
  });
  
  L.tileLayer.appleMapsTiles = function (auth, opts) {
    return new L.TileLayer.AppleMapsTiles(auth, opts);
  }
