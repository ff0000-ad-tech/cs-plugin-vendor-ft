const argv = require('minimist')(process.argv.slice(2))
const packager = require('./lib/packager.js')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('cs-plugin-vendor-ft')

global.api = `http://${argv.api}`

switch (argv.cmd) {
	case 'vendor-ft':
		log(argv)
		log('argv.profile:', argv.profile)
		const targets = JSON.parse(argv.targets)
		log('targets:', targets)
		const folders = JSON.parse(argv.folders)
		log('folders:', folders)
		packager.createVendorPackage(argv.profile, folders, targets)
		break
}

/*

node "/Users/kenny.arehart/Documents/_CLIENTS/ESPN/ESPN_MLB_2018/ES6/regular_season_clone_vendor/node_modules/@ff0000-ad-tech/cs-plugin-vendor-c20/index.js" --cmd vendor-c20 --api '10.0.86.13:5200' --profile 'preview' --targets '{"preview/300x250/index.html":"/3-traffic/preview/300x250/","preview/320x50/index.html":"/3-traffic/preview/320x50/","preview/728x90/index.html":"/3-traffic/preview/728x90/"}'

*/
