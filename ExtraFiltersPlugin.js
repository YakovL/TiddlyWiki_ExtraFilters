/***
|Documentation|https://yakovl.github.io/TiddlyWiki_ExtraFilters/#ExtraFiltersPluginInfo|
|Source       |https://github.com/YakovL/TiddlyWiki_ExtraFilters/blob/master/ExtraFiltersPlugin.js|
|Author       |Yakov Litvin|
|Version      |1.4.1|
|~CoreVersion |2.6.1|
|Licence      |[[BSD-like open source license|https://yakovl.github.io/TiddlyWiki_ExtraFilters/#%5B%5BYakov%20Litvin%20Public%20Licence%5D%5D]] |
***/
//{{{
config.filters.all = config.filters.all || function(results, match) {
    this.forEachTiddler(function(tName, tiddler) {
        results.pushUnique(tiddler)
    })
    return results
}

config.filters.and = function(results, match) {
	// parse the argument as "filterName[filterParam"
	var dividingRE = /([^\[\]]+)\[([^\]]*)/
	var filterParts = dividingRE.exec(match[3])
	if(filterParts) {
		var filterName  = filterParts[1]
		var filterParam = filterParts[2]
	} else throw('"and" filter: wrong syntax')

	// create the set of filtered tiddlers
	var filter = "[" + filterName + "[" + filterParam + "]]"
	var tids = this.filterTiddlers(filter)
	var newResult = []

	// collect tiddlers present among both "results" and filtered tiddlers
	for(var i = 0; i < results.length; i++)
		for(var j = 0; j < tids.length; j++)
			if(results[i] == tids[j])
				newResult.push(tids[j])

	return newResult
}

config.filters.not = function(results, match) {
	// parse the argument as "filterName[filterParam"
	var dividingRE = /([^\[\]]*)\[([^\]]*)/
	var filterParts = dividingRE.exec(match[3])
	if(filterParts) {
		var filterName  = filterParts[1]
		var filterParam = filterParts[2]
	} else throw('\"not\" filter: wrong syntax')

	// create the set of filtered tiddlers
	var filter = "[" + filterName + "[" + filterParam + "]]"
	var tids = this.filterTiddlers(filter)

	// collect tiddlers present among "results", but not among filtered tiddlers
	for(var i = 0; i < results.length; i++)
		for(var j = 0; j < tids.length; j++)
			if(results[i] == tids[j]) {
				results.splice(i--, 1)
				tids.splice(j, 1)
				break
			}

	return results
}

config.filters.tagTree = function(results, match) {
	var depthRE = /^(\d),(.+)$/, depthMatch = depthRE.exec(match[3])
	var depth = depthMatch ? parseInt(depthMatch[1]) : -1, currentDepth = 0
	var root = depthMatch ? depthMatch[2] : match[3], tags = [root], prevLength
	var i, tagTags, j

	var rootTid = store.fetchTiddler(root)
	if(rootTid) results.pushUnique(rootTid)

	// get tags, tags of tags etc ;
	// for optimization, push to results inline
	do {
		prevLength = tags.length
        //# this may be optimized by starting from i = ..
		for(i = 0; i < prevLength; i++) {
			tagTags = store.getTaggedTiddlers(tags[i])
			for(j = 0; j < tagTags.length; j++) {
				tags.pushUnique(tagTags[j].title)

				// optimized place to push:
				results.pushUnique(tagTags[j])
			}
		}
		currentDepth++
	} while (tags.length > prevLength && currentDepth != depth)

	return results
}

config.filters.unclassified = function(results, match) {
	var category = match[3]
	var instances = this.getTaggedTiddlers(category)

	// filter out tiddlers tagged with instances
	for(var i = 0; i < results.length; i++)
		for(var j = 0; j < instances.length; j++)
			if(results[i].isTagged(instances[j].title)) {
				results.splice(i--, 1)
				break
			}

	return results
}

config.filters.taggedOnly =
config.filters.oTag = function(results, match) {

	// parse param
	var add = true, arg = match[3], i
	switch(arg.substring(0, 1)) {
		case "+":
			// "add" is "true" already
			arg = arg.substring(1)
			break
		case "-":
			add = false
			arg = arg.substring(1)
			break
	}

	var isTaggedOnly = function(tiddler, arg) {
		return (tiddler.tags.length == 1) && (!arg || arg == tiddler.tags[0])
	}

	if(add) {
		var tiddlers = this.reverseLookup()
		for(i = 0; i < tiddlers.length; i++)
			if(isTaggedOnly(tiddlers[i], arg))
				results.pushUnique(tiddlers[i])
	} else {
		for(i = 0; i < results.length; i++)
			if(!isTaggedOnly(results[i], arg))
				results.splice(i--, 1)
	}

	return results
}

config.filters.hasPart = function(results, match) {
	// parse the argument
	var arg = match[3], reText, re, type, getPart, title

	switch(arg.substr(0, 2)) {
		case "##": // config.textPrimitives.sectionSeparator
		case "::": // config.textPrimitives.sliceSeparator
			getPart = function(title) {
				return store.getTiddlerText(title + arg)
			}
			break
		case "@@":
			getPart = function(title) {
				return store.getValue(title, arg.substr(2))
			}
			break
		case "r@": // regExp (for tiddler.text) mode
		case "R@":
		case "t@": // title mode
		case "T@":
			reText = store.getTiddlerText(arg.substr(2))
			type = arg.substring(0, 1)
			if(!reText) {
				if(type == "r" || type == "t")
					return results // "forgiving mode", nothing is filtered out in this case
				else
					throw("RegExp for filtering is not found in " + arg.substring(2))
			}

			// no break here
		case "r[":
		case "R[":
		case "t[":
		case "T[":
			if(!reText) {
				reText = arg.substring(2)
				type = arg.substr(0, 1)
			}

			if(type == "r" || type == "t") {
				try {
					re = new RegExp(reText)
				} catch(e) {
					return results // "forgiving mode"
				}
			} else re = new RegExp(reText)

			getPart = (type == "r" || type == "R") ?
				function(title) {
					var partMatches = results[i].text.match(re)
					return partMatches ? partMatches[0] : null
				} :
				function(title) {
					var partMatches = title.match(re)
					return partMatches ? partMatches[0] : null
				}
			break
		default:
			return results
	}

	// filter out corresponding tiddlers
	for(var i = 0; i < results.length; i++) {
		title = results[i].title
		if(!getPart(title)) results.splice(i--, 1)
	}
	return results
}

config.filters.sortByText = function (results, match) {
	// parse the argument
	var arg = match[3]
	var ascending = +1
	switch(arg[0]) {
		case "-":
			ascending = -1
			arg = arg.substring(1)
			break
		case "+":
			arg = arg.substring(1)
			break
	}

	// use the rest of the argument to get corresponding section/slice
	var partSuffix = (arg.substr(0, 2) == "::" || arg.substr(0, 2) == "##") ?
			arg : ""

	var self = this
	var compareText = function(t1, t2) {
		var text1 = self.getTiddlerText(t1.title + partSuffix)
		var text2 = self.getTiddlerText(t2.title + partSuffix)
		if(text1 && text2)
			return text1.localeCompare(text2) * ascending
		if(text1)
			return -1 * ascending
		if(text2)
			return 1 * ascending
		return 0
	}

	return results.sort(compareText)
}

orig_sortFilter = config.filters.sort
config.filters.sort = function(results, match) {

	if(match[3] !== "*random") return orig_sortFilter.apply(this, arguments)

	var auxiliaryArray = []
	var size = results.length
	var swap = function(i, j) {
		var tmp1 = auxiliaryArray[i]
		auxiliaryArray[i] = auxiliaryArray[j]
		auxiliaryArray[j] = tmp1
		var tmp2 = results[i]
		results[i] = results[j]
		results[j] = tmp2
	}

	for(var i = 0; i < size; i++)
		auxiliaryArray.push(Math.random())

	for(var j = 0; j < size; j++)
		for(var i = 0; i < size - j; i++)
			if(auxiliaryArray[i] < auxiliaryArray[i + 1])
				swap(i, i + 1)
	return results
}

config.filters.from = function(results, match) {
	var filter = this.getTiddlerText(match[3], "")
	var tiddlers = this.filterTiddlers(filter)

	for(var i = 0; i < tiddlers.length; i++)
		results.pushUnique(tiddlers[i])

	return results
}
//}}}