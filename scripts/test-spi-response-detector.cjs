'use strict';
// Exposed development cases; never described as held out.
const assert=require('node:assert/strict');
const {compare,parseStrictJSON}=require('./spi-response-detector.cjs');
let passed=0;
const ref=word=>({schema_version:1,transactions:[{id:'one',expected:word}]});
const obs=word=>({schema_version:1,transactions:[{id:'one',observed:word}]});
function check(name,test){test();passed++;}
check('case normalization',()=>assert.equal(compare(ref('AbCdEf01'),obs('aBcDeF01')).status,'PASS'));
for(let bit=0;bit<32;bit++)check('single bit '+bit,()=>{
 const word=(2**bit).toString(16).padStart(8,'0'),r=compare(ref('00000000'),obs(word));
 assert.equal(r.status,'ALARM');assert.deepEqual(r.alarms[0].differing_bits_lsb0,[bit]);
});
check('all bits',()=>assert.deepEqual(compare(ref('ffffffff'),obs('00000000')).alarms[0].differing_bits_lsb0,Array.from({length:32},(_,i)=>i)));
check('missing',()=>assert.equal(compare(ref('12345678'),{schema_version:1,transactions:[]}).summary.missing,1));
check('unexpected and missing',()=>{const x=obs('12345678');x.transactions[0].id='other';assert.equal(compare(ref('12345678'),x).alarms.length,2);});
check('special id and row order',()=>{
 const r={schema_version:1,transactions:[{id:'__proto__',expected:'12345678'},{id:'constructor',expected:'abcdef01'}]};
 const o={schema_version:1,transactions:r.transactions.map(t=>({id:t.id,observed:t.expected})).reverse()};
 assert.equal(compare(r,o).status,'PASS');assert.equal(o.transactions[0].id,'constructor');
});
for(const word of [12345678,'123','0x12345678','xxxx0000','1234567z',null])check('invalid word '+word,()=>assert.equal(compare(ref('12345678'),obs(word)).status,'INVALID'));
check('empty reference',()=>assert.equal(compare({schema_version:1,transactions:[]},{schema_version:1,transactions:[]}).status,'INVALID'));
check('duplicate ids',()=>{const o=obs('12345678');o.transactions.push({...o.transactions[0]});assert.equal(compare(ref('12345678'),o).status,'INVALID');});
check('unknown fields',()=>{const r=ref('12345678');r.ignore=true;assert.equal(compare(r,obs('12345678')).status,'INVALID');});
check('decoded duplicate JSON key',()=>assert.throws(()=>parseStrictJSON('{"id":1,"\\u0069d":2}')));
check('strict trailing JSON',()=>assert.throws(()=>parseStrictJSON('{"a":1} false')));
check('strict commas',()=>assert.throws(()=>parseStrictJSON('[1,]')));
check('string escapes',()=>assert.equal(parseStrictJSON('{"x":"a\\\"b\\\\c"}').x,'a"b\\c'));
console.log(JSON.stringify({suite:'exposed-development',passed,result:'PASS'}));
