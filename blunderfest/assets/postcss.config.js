const OpenProps = require('open-props');
const postcssJitProps = require('postcss-jit-props');

/** @type {import('postcss-load-config').Config} */
const config = {
    plugins: [
        require('autoprefixer'),
        require("postcss-import"),
        postcssJitProps({ ...OpenProps }),
    ]
}

module.exports = config;
