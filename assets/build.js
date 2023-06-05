const esbuild = require('esbuild')

const args = process.argv.slice(2)
const watch = args.includes('--watch')
const deploy = args.includes('--deploy')
let opts = {
  entryPoints: ['src/index.tsx'],
  bundle: true,
  logLevel: 'info',
  target: 'es2017',
  outdir: '../priv/static/assets',
  external: ['*.css', 'fonts/*', 'images/*'],
  plugins: []
}

if (deploy) {
  opts = {
    ...opts,
    minify: true
  }
}

if (watch) {
  opts = {
    ...opts,
    sourcemap: 'inline'
  }
  esbuild
    .context(opts)
    .then((ctx) => {
      ctx.watch()
    })
    .catch((_error) => {
      process.exit(1)
    })
} else {
  esbuild.build(opts)
}
