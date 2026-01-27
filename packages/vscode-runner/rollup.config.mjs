import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const isProduction = process.env.NODE_ENV === "production";

export default {
  input: "src/plugin.ts",
  output: {
    file: "com.ugaya40.vscode-runner.sdPlugin/bin/plugin.js",
    format: "es",
    sourcemap: !isProduction,
  },
  plugins: [
    typescript({ sourceMap: !isProduction }),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    isProduction && terser(),
  ],
};
