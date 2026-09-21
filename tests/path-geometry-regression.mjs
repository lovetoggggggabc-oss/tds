import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile("game.js", "utf8");
const block = source.slice(source.indexOf("const MAP_DEFINITIONS"), source.indexOf("const CONSTELLATION_ATTACK"))
 .replace("const MAP_DEFINITIONS", "this.MAP_DEFINITIONS").replace("let activeMap", "this.activeMap").replace("let activeRouteCache", "this.activeRouteCache");
const context={}; vm.createContext(context); vm.runInContext(block,context);
const maps=context.MAP_DEFINITIONS;
assert.deepEqual(Object.keys(maps),["ORIGINAL_S","CURVED_MAP","LOOP_MAP"]);
assert.deepEqual({...maps.ORIGINAL_S.spawn},{x:50,y:94}); assert.deepEqual({...maps.ORIGINAL_S.destination},{x:50,y:6});
assert.deepEqual({...maps.CURVED_MAP.spawn},{x:72,y:6}); assert.deepEqual({...maps.CURVED_MAP.destination},{x:42,y:94});
assert.deepEqual({...maps.LOOP_MAP.spawn},{x:27,y:94}); assert.deepEqual({...maps.LOOP_MAP.destination},{x:70,y:6});
for(const map of Object.values(maps)){assert.deepEqual({...map.route[0][0]},{...map.spawn});assert.deepEqual({...map.route.at(-1).at(-1)},{...map.destination});}
assert.equal(maps.LOOP_MAP.route.length,4); assert.match(source,/ROUTE_CACHES/); assert.match(source,/binary|while \(low < high\)/);
console.log("Path geometry regression passed: three cached ordered Bezier routes verified.");
