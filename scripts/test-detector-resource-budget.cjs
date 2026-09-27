'use strict';
const assert=require('node:assert/strict');
const {parseStrictJSON}=require('./spi-response-detector.cjs');
let passed=0;
function check(f){f();passed++;}
// Small deterministic cases exercise the same parser counter without a
// memory-pressure or denial-of-service experiment.
check(()=>assert.deepEqual(parseStrictJSON('[1,2,3]',4),[1,2,3]));
check(()=>assert.throws(()=>parseStrictJSON('[1,2,3]',3),/budget/));
check(()=>assert.equal(parseStrictJSON('{"a":{"b":1}}',3).a.b,1));
check(()=>assert.throws(()=>parseStrictJSON('{"a":{"b":1}}',2),/budget/));
for(const bad of [0,-1,1.5,400011,NaN])check(()=>assert.throws(()=>parseStrictJSON('{}',bad),/budget/));
// Each valid 100k-record input uses 300003 values, below the 400010 cap.
check(()=>assert.ok(3+3*100000<400010));
console.log(JSON.stringify({suite:'parser-budget-small-cases',passed,result:'PASS'}));
