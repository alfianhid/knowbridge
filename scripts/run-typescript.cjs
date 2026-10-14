// Development CLI runner using the project's already installed TypeScript compiler.
// Next.js remains responsible for compiling deployed application code.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
const script = path.resolve(process.argv[2] ?? '');
if (!script.startsWith(path.resolve(__dirname) + path.sep) || !script.endsWith('.ts')) {
  throw new Error('Only checked-in TypeScript scripts can run.');
}
require(script);
