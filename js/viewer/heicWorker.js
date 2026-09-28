importScripts("https://cdn.jsdelivr.net/npm/libheif-js@1.23.2/libheif-wasm/libheif-bundle.js");

const { HeifDecoder } = libheif();
const heifDecoder = new HeifDecoder();

async function decodeHeic(url) {
  let req = await fetch(url);
  let heicBuffer = await req.arrayBuffer();
  let data = heifDecoder.decode(heicBuffer);

  let image = data[0];
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

  const imageData = new ImageData(array, width, height)
  return { imageData: imageData };
}

addEventListener(
  "message",
  async function (e) {
    const response = await decodeHeic(e.data.url);
    e.ports[0].postMessage({ data: response }, [response.imageData.data.buffer]);
  },
  false
);
