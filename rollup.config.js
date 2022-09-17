import { terser } from "rollup-plugin-terser";

const terserConfig = {
  module: true,
}

export default [
  {
    input: 'js/main.js',
    watch: {
      include: 'js/**',
      clearScreen: false
    },
    output: {
      file: 'static/dist/main.js',
      format: 'es',
      plugins: [terser(terserConfig)]
    }
  },
  {
    input: 'js/viewer/viewer.js',
    watch: {
      include: 'js/viewer/**',
      clearScreen: false
    },
    output: {
        file: 'static/dist/viewer.js',
        format: 'es',
        plugins: [terser(terserConfig)]
      }
  }
];
