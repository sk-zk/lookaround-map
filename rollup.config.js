import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from "rollup-plugin-terser";
import css from "rollup-plugin-import-css";
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';

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
      //plugins: [terser(terserConfig)]
    },
    plugins: [css(), nodeResolve(), typescript({compilerOptions: {target: "es6"}}), commonjs()]
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
    },
    plugins: [css(), nodeResolve()]
  }
];
