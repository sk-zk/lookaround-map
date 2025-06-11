importScripts("https://cdn.jsdelivr.net/npm/libheif-js@1.17.1/libheif-wasm/libheif-bundle.js");

const { HeifDecoder } = libheif();
const heifDecoder = new HeifDecoder();

async function decodeHeic(url) {
  const req = await fetch(url + "?format=heic");
  const heicBuffer = await req.arrayBuffer();
  const data = heifDecoder.decode(heicBuffer);
  const image = data[0];
  const width = image.get_width();
  const height = image.get_height();
  const array = await new Promise((resolve, reject) => {
    image.display(
      { data: new Uint8ClampedArray(width * height * 4), width, height },
      (displayData) => {
        if (!displayData) {
          return reject(new Error("HEIF processing error"));
        }
        resolve(displayData.data);
      }
    );
  });
  return { buffer: array, width: width, height: height };
}

addEventListener(
  "message",
  async (e) => {
    const data = await decodeHeic(e.data.url);
    e.ports[0].postMessage({ data: data });
  },
  false
);
