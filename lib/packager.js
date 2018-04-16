const fs = require('fs-extra')
const path = require('path')
const walk = require('walk')
const JSZIP = require('jszip')
const debug = require('@ff0000-ad-tech/debug')
let log = debug('cs-plugin-vendor-c20:packager')

function createVendorPackage(profileName, targets) {
	log('createVendorPackage()')
	return new Promise((resolve, reject) => {
		// make the top level directory
		const dir = './4-vendor/' + profileName + '/'
		fs.emptyDirSync(dir)
		
		resolve()
	})	
}

module.exports = {
	createVendorPackage
}
