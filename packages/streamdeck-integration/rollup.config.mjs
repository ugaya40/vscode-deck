import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const isProduction = process.env.NODE_ENV === "production";

const plugins = [
  typescript({ sourceMap: !isProduction }),
  nodeResolve({ preferBuiltins: true, extensions: [".ts", ".js"] }),
  commonjs(),
  isProduction && terser(),
];

export default [
  {
    input: "src/extension.ts",
    output: {
      file: "dist/extension.js",
      format: "es",
      sourcemap: !isProduction,
    },
    external: ["vscode"],
    plugins,
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "es",
      sourcemap: !isProduction,
    },
    plugins,
  },
];
