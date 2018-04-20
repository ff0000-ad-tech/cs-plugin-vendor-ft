const fs = require('fs-extra')
const RegEx = require('./regex')
const Hooks = require('@ff0000-ad-tech/hooks-regex')
const debug = require('@ff0000-ad-tech/debug')
let log = debug('cs-plugin-vendor-ft:clicktag')

function parse(path) {
	return new Promise((resolve, reject) => {
		fs.readFile(path + 'index.html', 'utf8', (err, data) => {
			const clickTagMatch = data.match(Hooks.get('Red', 'Network', 'clicktags'))[0]
			const fetch = clickTagMatch.match(RegEx.clickTagVars)

			resolve(fetch.length)
		})
	})
}

module.exports = {
	parse
}
