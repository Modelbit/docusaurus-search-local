"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postBuildFactory = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const util_1 = tslib_1.__importDefault(require("util"));
const buildIndex_1 = require("./buildIndex");
const debug_1 = require("./debug");
const processDocInfos_1 = require("./processDocInfos");
const scanDocuments_1 = require("./scanDocuments");
const writeFileAsync = util_1.default.promisify(fs_1.default.writeFile);
function postBuildFactory(config, searchIndexFilename) {
    return function postBuild(buildData) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            (0, debug_1.debugInfo)("gathering documents");
            const data = (0, processDocInfos_1.processDocInfos)(buildData, config);
            (0, debug_1.debugInfo)("parsing documents");
            for (const versionData of data) {
                // Give every index entry a unique id so that the index does not need to store long URLs.
                const allDocuments = yield (0, scanDocuments_1.scanDocuments)(versionData.paths);
                (0, debug_1.debugInfo)("building index");
                const docsByDirMap = new Map();
                const { searchContextByPaths, hideSearchBarWithNoSearchContext, useAllContextsWithNoSearchContext, } = config;
                if (searchContextByPaths) {
                    const { baseUrl } = buildData;
                    const rootAllDocs = [];
                    if (!hideSearchBarWithNoSearchContext) {
                        docsByDirMap.set("", rootAllDocs);
                    }
                    let docIndex = 0;
                    for (const documents of allDocuments) {
                        rootAllDocs[docIndex] = [];
                        for (const doc of documents) {
                            if (doc.u.startsWith(baseUrl)) {
                                const uri = doc.u.substring(baseUrl.length);
                                const matchedPath = searchContextByPaths.find((path) => uri === path || uri.startsWith(`${path}/`));
                                if (matchedPath) {
                                    let dirAllDocs = docsByDirMap.get(matchedPath);
                                    if (!dirAllDocs) {
                                        dirAllDocs = [];
                                        docsByDirMap.set(matchedPath, dirAllDocs);
                                    }
                                    let dirDocs = dirAllDocs[docIndex];
                                    if (!dirDocs) {
                                        dirAllDocs[docIndex] = dirDocs = [];
                                    }
                                    dirDocs.push(doc);
                                    if (!useAllContextsWithNoSearchContext) {
                                        continue;
                                    }
                                }
                            }
                            rootAllDocs[docIndex].push(doc);
                        }
                        docIndex++;
                    }
                    for (const [k, v] of docsByDirMap) {
                        const docsNotEmpty = v.filter((d) => !!d);
                        if (docsNotEmpty.length < v.length) {
                            docsByDirMap.set(k, docsNotEmpty);
                        }
                    }
                }
                else {
                    docsByDirMap.set("", allDocuments);
                }
                for (const [k, allDocs] of docsByDirMap) {
                    const searchIndex = (0, buildIndex_1.buildIndex)(allDocs, config);
                    (0, debug_1.debugInfo)(`writing index (/${k}) to disk`);
                    yield writeFileAsync(path_1.default.join(versionData.outDir, searchIndexFilename.replace("{dir}", k === "" ? "" : `-${k.replace(/\//g, "-")}`)), JSON.stringify(searchIndex), { encoding: "utf8" });
                    (0, debug_1.debugInfo)(`index (/${k}) written to disk successfully!`);
                }
            }
        });
    };
}
exports.postBuildFactory = postBuildFactory;
