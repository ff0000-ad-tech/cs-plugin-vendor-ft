const fs = require('fs-extra')
const RegEx = require('./regex')
const AdType = require('./adType')
const debug = require('@ff0000-ad-tech/debug')
let log = debug('cs-plugin-vendor-ft:manifest')

let storedFtData = null
let storedImageMap = null

function parseFtData(context, build) {
	// log('parseFtData()', context, build)
	storedFtData = []
	storedImageMap = null
	return new Promise((resolve, reject) => {
		const pathFtData = context + '/' + build + '/common/js/data/FtData.js'
		// log('pathFtData:', pathFtData)
		fs.readFile(pathFtData, 'utf8', (err, data) => {
			const labelMatches = data.match(RegEx.ftDataTypes)
			// log('labelMatches:', labelMatches.length)
			// log(labelMatches)

			const dataMatches = data.split(RegEx.ftDataTypes)
			dataMatches.shift()
			// log('dataMatches:', dataMatches.length)
			// log(dataMatches)

			for (let i = 0; i < labelMatches.length; i++) {
				const labelType = labelMatches[i].slice(labelMatches[i].indexOf('-') + 1)
				// log(' -> labelType:', labelType)

				if (labelType == 'end-keys') {
					// skip
				} else if (labelType == 'image-map') {
					// strip comments
					const singleData = dataMatches[i].replace(RegEx.lineComments, '')
					const stripVar = singleData.substr(singleData.indexOf('{'))
					// store for later use on a per size basis
					storedImageMap = JSON.parse(stripVar)
				} else {
					let value = RegEx.ftDataValue.exec(dataMatches[i])[3]
					value = value.slice(0, value.length - 1) // removes a trailing ' or "
					storedFtData.push({
						type: labelType,
						name: RegEx.ftDataNames.exec(dataMatches[i])[1],
						default: value
					})
				}
			}
			// log(storedFtData)

			resolve()
		})
	})
}

function parseFtDataImageMap(json, size) {
	for (let key in storedImageMap) {
		let val = ''
		if (size in storedImageMap[key]) {
			val = storedImageMap[key][size]
		} else if ('default' in storedImageMap[key]) {
			val = storedImageMap['default']
		}
		json['instantAds'].push({
			type: 'image',
			name: key,
			default: val
		})
	}
}

function transform(dataRaw, buildData) {
	// remove comments, TF.manifest(
	// UPDATE to use dotAll [\s\S]
	let toStringJSON = dataRaw.replace(/\/\/.+/g, '').replace(/FT\.manifest\(/g, '')

	let index = toStringJSON.lastIndexOf('})')
	// log('index:', index)
	toStringJSON = toStringJSON.substring(0, index + 1)
	// log('toStringJSON:', toStringJSON)

	let manifestJSON = JSON.parse(toStringJSON)
	log(manifestJSON)

	// update base properties
	manifestJSON['width'] = buildData['dimensions'][0]
	manifestJSON['height'] = buildData['dimensions'][1]
	// 	manifest_json['clickTagCount'] = len(self.settings.clicktags[size['deploy_size']])

	// add rich-loads
	manifestJSON['richLoads'].push({
		name: 'richloadBase',
		src: buildData.directories.name['rich']
	})

	// set instandAds-reference to richLoads
	manifestJSON['instantAds'].push({
		name: 'richloadBase',
		type: 'richLoad'
	})

	// if expandable, create a manifest node for the expanded params
	if (buildData['adType'] == AdType.EXPANDABLE) {
		manifestJSON['expand'] = {
			width: buildData['dimensionsExpand'][0],
			height: buildData['dimensionsExpand'][1],
			indentAcross: 0,
			indentDown: 0
		}

		// add expandable to richload/instantAds
		manifestJSON['richLoads'].push({
			name: 'richloadExpand',
			src: buildData.directories.name['expanded']
		})
		manifestJSON['instantAds'].push({
			name: 'richloadExpand',
			type: 'richLoad'
		})
	}

	// apply the FtData
	storedFtData.forEach(target => {
		manifestJSON['instantAds'].push(target)
	})

	// apply the imageMap
	parseFtDataImageMap(manifestJSON, buildData['dimensions'].join('x'))

	return manifestJSON
}

module.exports = {
	parseFtData,
	transform
}
