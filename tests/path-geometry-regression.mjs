import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile("game.js", "utf8");
const block = source.slice(source.indexOf("const MAP_DEFINITIONS"), source.indexOf("const CONSTELLATION_ATTACK"))
 .replace("const MAP_DEFINITIONS", "this.MAP_DEFINITIONS").replace("let activeMap", "this.activeMap").replace("let activeRouteCache", "this.activeRouteCache");
const context={}; vm.createContext(context); vm.runInContext(block,context);
const maps=context.MAP_DEFINITIONS;
assert.deepEqual(Object.keys(maps),["ORIGINAL_S","CURVED_MAP","LOOP_MAP"]);
assert.deepEqual({...maps.ORIGINAL_S.spawn},{x:46.8,y:85.6}); assert.deepEqual({...maps.ORIGINAL_S.destination},{x:65.8,y:6.2});
assert.deepEqual({...maps.CURVED_MAP.spawn},{x:73.2,y:8.2}); assert.deepEqual({...maps.CURVED_MAP.destination},{x:47.2,y:84.5});
assert.deepEqual({...maps.LOOP_MAP.spawn},{x:46.2,y:86.5}); assert.deepEqual({...maps.LOOP_MAP.destination},{x:73.2,y:8.5});
for(const map of Object.values(maps)){assert.deepEqual({...map.route[0][0]},{...map.spawn});assert.deepEqual({...map.route.at(-1).at(-1)},{...map.destination});}
assert.equal(maps.CURVED_MAP.route.length,160); assert.equal(maps.LOOP_MAP.route.length,160); assert.match(source,/ROUTE_CACHES/); assert.match(source,/binary|while \(low < high\)/);
assert.equal(maps.ORIGINAL_S.assetWidth,885); assert.equal(maps.CURVED_MAP.assetWidth,883); assert.equal(maps.LOOP_MAP.assetWidth,882);
assert.equal(maps.ORIGINAL_S.route.length,160);
assert.match(source,/stepsPerSegment = map\.route\.length >= 160 \? 40 : 80/);
assert.ok(maps.ORIGINAL_S.route.some((segment)=>segment[0].x>=36 && segment[0].x<38 && segment[0].y>=60 && segment[0].y<=62));
assert.ok(maps.ORIGINAL_S.route.some((segment)=>segment[0].x>=65 && segment[0].x<=66.5 && segment[0].y>=40 && segment[0].y<=44));
console.log("Path geometry regression passed: three cached ordered Bezier routes verified.");
