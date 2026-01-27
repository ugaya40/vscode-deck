import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const isProduction = process.env.NODE_ENV === "production";

export default {
  input: "src/extension.ts",
  output: {
    file: "dist/extension.js",
    format: "es",
    sourcemap: !isProduction,
  },
  external: ["vscode"],
  plugins: [
    typescript({ sourceMap: !isProduction }),
    nodeResolve({ preferBuiltins: true, extensions: [".ts", ".js"] }),
    commonjs(),
    isProduction && terser(),
  ],
};
