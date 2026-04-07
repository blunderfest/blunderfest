import path from 'path';
import { createCompiler } from '@vanilla-extract/compiler';
import { getPackageInfo, cssFileFilter, transform, normalizePath } from '@vanilla-extract/integration';

const virtualExtCss = '.vanilla.css';
const isVirtualId = id => id.endsWith(virtualExtCss);
const fileIdToVirtualId = id => `${id}${virtualExtCss}`;
const virtualIdToFileId = virtualId => virtualId.slice(0, -virtualExtCss.length);
const removeIncompatiblePlugins = plugin => typeof plugin === 'object' && plugin !== null && 'name' in plugin &&
// Prevent an infinite loop where the compiler creates a new instance of the plugin,
// which creates a new compiler, which creates a new instance of the plugin, etc.
plugin.name !== 'vanilla-extract' &&
// Skip Remix because it throws an error if it's not loaded with a config file.
// If it _is_ loaded with a config file, it will create an infinite loop because it
// also has a child compiler which uses the same mechanism to load the config file.
// https://github.com/remix-run/remix/pull/7990#issuecomment-1809356626
// Additionally, some internal Remix plugins rely on a `ctx` object to be initialized by
// the main Remix plugin, and may not function correctly without it. To address this, we
// filter out all Remix-related plugins.
!plugin.name.startsWith('remix') &&
// As React-Router plugin works the same as Remix plugin, also ignore it.
!plugin.name.startsWith('react-router');
function vanillaExtractPlugin({
  identifiers,
  unstable_mode: mode = 'emitCss'
} = {}) {
  let config;
  let configEnv;
  let server;
  let packageName;
  let compiler;
  const vitePromise = import('vite');
  const getIdentOption = () => identifiers ?? (config.mode === 'production' ? 'short' : 'debug');
  const getAbsoluteId = filePath => {
    let resolvedId = filePath;
    if (filePath.startsWith(config.root) ||
    // In monorepos the absolute path will be outside of config.root, so we check that they have the same root on the file system
    // Paths from vite are always normalized, so we have to use the posix path separator
    path.isAbsolute(filePath) && filePath.split(path.posix.sep)[1] === config.root.split(path.posix.sep)[1]) {
      resolvedId = filePath;
    } else {
      // In SSR mode we can have paths like /app/styles.css.ts
      resolvedId = path.join(config.root, filePath);
    }
    return normalizePath(resolvedId);
  };
  function invalidateModule(absoluteId) {
    if (!server) return;
    const {
      moduleGraph
    } = server;
    const modules = moduleGraph.getModulesByFile(absoluteId);
    if (modules) {
      for (const module of modules) {
        moduleGraph.invalidateModule(module);

        // Vite uses this timestamp to add `?t=` query string automatically for HMR.
        module.lastHMRTimestamp = module.lastInvalidationTimestamp || Date.now();
      }
    }
  }
  return {
    name: 'vanilla-extract',
    configureServer(_server) {
      server = _server;
    },
    config(_userConfig, _configEnv) {
      configEnv = _configEnv;
      return {
        ssr: {
          external: ['@vanilla-extract/css', '@vanilla-extract/css/fileScope', '@vanilla-extract/css/adapter']
        }
      };
    },
    async configResolved(_resolvedConfig) {
      config = _resolvedConfig;
      packageName = getPackageInfo(config.root).name;
    },
    async buildStart() {
      // Ensure we re-use the compiler instance between builds, e.g. in watch mode
      if (mode !== 'transform' && !compiler) {
        var _configForViteCompile;
        const {
          loadConfigFromFile
        } = await vitePromise;
        let configForViteCompiler;

        // The user has a vite config file
        if (config.configFile) {
          const configFile = await loadConfigFromFile({
            command: config.command,
            mode: config.mode,
            isSsrBuild: configEnv.isSsrBuild
          }, config.configFile);
          configForViteCompiler = configFile === null || configFile === void 0 ? void 0 : configFile.config;
        }
        // The user is using a vite-based framework that has a custom config file
        else {
          configForViteCompiler = config.inlineConfig;
        }
        const viteConfig = {
          ...configForViteCompiler,
          plugins: (_configForViteCompile = configForViteCompiler) === null || _configForViteCompile === void 0 || (_configForViteCompile = _configForViteCompile.plugins) === null || _configForViteCompile === void 0 ? void 0 : _configForViteCompile.flat().filter(removeIncompatiblePlugins)
        };
        compiler = createCompiler({
          root: config.root,
          identifiers: getIdentOption(),
          cssImportSpecifier: fileIdToVirtualId,
          viteConfig
        });
      }
    },
    buildEnd() {
      // When using the rollup watcher, we don't want to close the compiler after every build.
      // Instead, we close it when the watcher is closed via the closeWatcher hook.
      if (!config.build.watch) {
        var _compiler;
        (_compiler = compiler) === null || _compiler === void 0 || _compiler.close();
      }
    },
    closeWatcher() {
      var _compiler2;
      return (_compiler2 = compiler) === null || _compiler2 === void 0 ? void 0 : _compiler2.close();
    },
    async transform(code, id) {
      const [validId] = id.split('?');
      if (!cssFileFilter.test(validId)) {
        return null;
      }
      const identOption = getIdentOption();
      if (mode === 'transform') {
        return transform({
          source: code,
          filePath: normalizePath(validId),
          rootPath: config.root,
          packageName,
          identOption
        });
      }
      if (compiler) {
        const absoluteId = getAbsoluteId(validId);
        const {
          source,
          watchFiles
        } = await compiler.processVanillaFile(absoluteId, {
          outputCss: true
        });
        const result = {
          code: source,
          map: {
            mappings: ''
          }
        };

        // We don't need to watch files in build mode
        if (config.command === 'build' && !config.build.watch) {
          return result;
        }
        for (const file of watchFiles) {
          if (!file.includes('node_modules') && normalizePath(file) !== absoluteId) {
            this.addWatchFile(file);
          }

          // We have to invalidate the virtual module & deps, not the real one we just transformed
          // The deps have to be invalidated in case one of them changing was the trigger causing
          // the current transformation
          if (cssFileFilter.test(file)) {
            invalidateModule(fileIdToVirtualId(file));
          }
        }
        return result;
      }
    },
    resolveId(source) {
      var _compiler3;
      const [validId, query] = source.split('?');
      if (!isVirtualId(validId)) return;
      const absoluteId = getAbsoluteId(validId);
      if ( // We should always have CSS for a file here.
      // The only valid scenario for a missing one is if someone had written
      // a file in their app using the .vanilla.js/.vanilla.css extension
      (_compiler3 = compiler) !== null && _compiler3 !== void 0 && _compiler3.getCssForFile(virtualIdToFileId(absoluteId))) {
        // Keep the original query string for HMR.
        return absoluteId + (query ? `?${query}` : '');
      }
    },
    load(id) {
      const [validId] = id.split('?');
      if (!isVirtualId(validId) || !compiler) return;
      const absoluteId = getAbsoluteId(validId);
      const {
        css
      } = compiler.getCssForFile(virtualIdToFileId(absoluteId));
      return css;
    }
  };
}

export { vanillaExtractPlugin };
