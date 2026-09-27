'use strict';
// Exposed, benign development checks. Independently frozen evaluations are separate.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const out=path.resolve(root,process.argv[2]||'evidence/defensive-detector-2026-09-26/envelope-development-01');
if(fs.existsSync(out))throw Error('Refusing to overwrite an evaluation');
fs.mkdirSync(out,{recursive:true});
const sourceHash=sha(fs.readFileSync(path.join(__dirname,'spi-response-detector.cjs'))),results=[];
const write=(p,data)=>fs.writeFileSync(p,typeof data==='string'?data:JSON.stringify(data));
function run(name,change,expected){
 const dir=path.join(out,name);fs.mkdirSync(dir);
 const ref={schema_version:1,transactions:[{id:'sample',expected:'12345678'}]};
 const obs={schema_version:1,transactions:[{id:'sample',observed:'12345678'}]};
 write(path.join(dir,'reference.json'),ref);write(path.join(dir,'observed.json'),obs);
 const m={schema_version:1,recording_id:name,detector_version:'1.1.0',detector_sha256:sourceHash,reference:{file:'reference.json',sha256:sha(fs.readFileSync(path.join(dir,'reference.json')))},observed:{file:'observed.json',sha256:sha(fs.readFileSync(path.join(dir,'observed.json')))}};
 let raw=JSON.stringify(m);if(change)raw=change({dir,ref,obs,m,raw,write,sha});
 write(path.join(dir,'recording.json'),raw);
 const output=path.join(dir,'result.json'),pin=sha(Buffer.from(raw));
 const args=[path.join(__dirname,'verify-spi-recording.cjs'),'--manifest',path.join(dir,'recording.json'),'--manifest-sha256',pin,'--output',output];
 const r=cp.spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(r.status,{PASS:0,ALARM:1,INVALID:2}[expected],r.stderr);
 const report=JSON.parse(fs.readFileSync(output,'utf8'));assert.equal(report.status,expected);
 assert.equal(report.integrity.verified,expected!=='INVALID');
 if(expected==='PASS')assert.equal(report.comparison.alarms.length,0);
 if(expected==='ALARM')assert.deepEqual(report.comparison.alarms[0].differing_bits_lsb0,[0]);
 if(expected==='INVALID')assert.equal(report.comparison,null);
 const before=fs.readFileSync(output),repeat=cp.spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(repeat.status,2);assert.deepEqual(fs.readFileSync(output),before);
 results.push({name,status:report.status,verified:report.integrity.verified,existing_output_preserved:true});
}
run('matching',null,'PASS');
run('one-bit',({dir,obs,m,write,sha})=>{obs.transactions[0].observed='12345679';write(path.join(dir,'observed.json'),obs);m.observed.sha256=sha(fs.readFileSync(path.join(dir,'observed.json')));return JSON.stringify(m);},'ALARM');
run('changed-observation',({dir,obs,raw,write})=>{obs.transactions[0].observed='12345679';write(path.join(dir,'observed.json'),obs);return raw;},'INVALID');
run('duplicate-key',({raw})=>raw.replace('"schema_version":1','"schema_version":1,"schema_version":1'),'INVALID');
const summary={created_at:new Date().toISOString(),detector_sha256:sourceHash,envelope_sha256:sha(fs.readFileSync(path.join(__dirname,'verify-spi-recording.cjs'))),passed:results.length,failed:0,results};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
