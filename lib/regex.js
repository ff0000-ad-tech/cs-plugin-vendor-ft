const cssHeight = /(height\:\s*)[0-9]+/
const cssWidth = /(width\:\s*)[0-9]+/
const cssRichLoadBase = /#richload-base\s*\{[^\}]+\}/g
const cssRichLoadExpand = /#richload-expand\s*\{[^\}]+\}/g
const dimension = /^([0-9]+)x([0-9]+)/g

const blockComments = /\/\*(.|[\s\s])*?(\*\/)/g
const lineComments = /[^\n\S]*\/\/[^\/\n][^\n]*/gm
const clickTagVars = /\n\s*var\s([^\s\=]+)/gm

const ftDataTypes = /\/\/\s*@ft\-[\s\S].+/g
const ftDataNames = /instantAds[\.\[\"\'\s]+([^\.\[\"\'\s]+)/g
const ftDataValue = /\|\|([^\"\']*)([\"\'])((?:[^\2\\]|\\.)*?\2)/g

module.exports = {
	blockComments,
	clickTagVars,
	cssHeight,
	cssWidth,
	cssRichLoadBase,
	cssRichLoadExpand,
	dimension,
	ftDataTypes,
	ftDataNames,
	ftDataValue,
	lineComments
}
