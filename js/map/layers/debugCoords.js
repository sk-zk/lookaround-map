L.GridLayer.DebugCoords = L.GridLayer.extend({
    createTile: function (coords) {
      var tile = document.createElement("div");
      tile.innerHTML = [coords.x, coords.y, coords.z].join(", ");
      tile.style.outline = "1px solid red";
      return tile;
    },
  });
  
  L.gridLayer.debugCoords = function (opts) {
    return new L.GridLayer.DebugCoords(opts);
  };
