'use strict';
// Optional defensive integrity envelope. No hardware, network, or trigger I/O.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const VERSION='1.0.0',COMPARATOR_VERSION='1.1.0';
const detectorPath=path.join(__dirname,'spi-response-detector.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=message=>{throw new Error(message);};
function readBounded(file,max){
  if(fs.lstatSync(file).isSymbolicLink())fail('Symbolic links are not accepted as recording inputs');
  const fd=fs.openSync(file,'r');
  try{
    const st=fs.fstatSync(fd);if(!st.isFile()||st.size>max)fail('Input must be a bounded regular file');
    const buffer=Buffer.alloc(st.size+1);let used=0;
    while(used<buffer.length){const n=fs.readSync(fd,buffer,used,buffer.length-used,null);if(n===0)break;used+=n;}
    if(used!==st.size||fs.fstatSync(fd).size!==st.size)fail('Input size changed during reading');
    return buffer.subarray(0,used);
  }finally{fs.closeSync(fd);}
}
const text=b=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);
function fields(value,expected,label){
  if(value===null||typeof value!=='object'||Array.isArray(value))fail(label+' must be an object');
  if(Object.keys(value).length!==expected.length||expected.some(k=>!Object.hasOwn(value,k)))fail(label+' has missing or unknown fields');
}
function pin(value){return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);}
function validId(value){return typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\x00-\x1f\x7f]/.test(value);}
function entry(value,label){
  fields(value,['file','sha256'],label);
  if(typeof value.file!=='string'||value.file.length>128||!/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(value.file))fail(label+' requires a simple .json basename');
  if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value.file))fail(label+' uses a reserved filename');
  if(!pin(value.sha256))fail(label+' requires a lowercase SHA-256');
}
function manifestSchema(m){
  fields(m,['schema_version','recording_id','detector_version','detector_sha256','reference','observed'],'manifest');
  if(m.schema_version!==1)fail('Manifest schema_version must be 1');
  if(!validId(m.recording_id))fail('Invalid recording_id');
  if(m.detector_version!==COMPARATOR_VERSION||!pin(m.detector_sha256))fail('Unsupported detector version or invalid detector pin');
  entry(m.reference,'reference');entry(m.observed,'observed');
  if(m.reference.file.toLowerCase()===m.observed.file.toLowerCase())fail('Reference and observation filenames must differ');
}
function run(argv){
  let output=null,recordingId=null,comparison=null,status='INVALID',errors;
  const integrity={verified:false,manifest_sha256:null,reference_sha256:null,observed_sha256:null,detector_sha256:null};
  try{
    const options=new Map(),allowed=new Set(['--manifest','--manifest-sha256','--output']);
    if(argv.length!==6)fail('Expected --manifest FILE --manifest-sha256 HASH --output NEW_FILE');
    for(let i=0;i<argv.length;i+=2){if(!allowed.has(argv[i])||options.has(argv[i])||!argv[i+1])fail('Unknown, duplicate, or missing CLI option');options.set(argv[i],argv[i+1]);}
    for(const key of allowed)if(!options.has(key))fail('Missing CLI option');
    const manifestPath=path.resolve(options.get('--manifest')),expected=options.get('--manifest-sha256');
    output=path.resolve(options.get('--output'));
    if(fs.existsSync(output)||output===manifestPath){output=null;fail('Output must be a new file distinct from inputs');}
    if(!/^[0-9a-fA-F]{64}$/.test(expected))fail('Manifest pin must be SHA-256');
    const manifestBytes=readBounded(manifestPath,65536);integrity.manifest_sha256=sha(manifestBytes);
    if(integrity.manifest_sha256!==expected.toLowerCase())fail('Manifest SHA-256 does not match detached pin');
    const manifestText=text(manifestBytes);
    // Bootstrap only with native JSON parsing and exact source-pin comparison.
    // Strict duplicate-key/schema validation follows using the pinned module.
    // No manifest-specified module path or unverified comparator is executed.
    const preliminary=JSON.parse(manifestText);
    if(preliminary===null||typeof preliminary!=='object'||!pin(preliminary.detector_sha256))fail('Manifest lacks detector source pin');
    const source=readBounded(detectorPath,1024*1024);integrity.detector_sha256=sha(source);
    if(preliminary.detector_sha256!==integrity.detector_sha256)fail('Detector source SHA-256 mismatch');
    const detector=require(detectorPath);
    const manifest=detector.parseStrictJSON(manifestText);manifestSchema(manifest);
    if(detector.VERSION!==COMPARATOR_VERSION)fail('Loaded detector version mismatch');
    recordingId=manifest.recording_id;
    const referencePath=path.join(path.dirname(manifestPath),manifest.reference.file);
    const observedPath=path.join(path.dirname(manifestPath),manifest.observed.file);
    if(output===referencePath||output===observedPath){output=null;fail('Output must differ from recording inputs');}
    const refBytes=readBounded(referencePath,16*1024*1024);integrity.reference_sha256=sha(refBytes);
    if(integrity.reference_sha256!==manifest.reference.sha256)fail('Reference byte hash mismatch');
    const obsBytes=readBounded(observedPath,16*1024*1024);integrity.observed_sha256=sha(obsBytes);
    if(integrity.observed_sha256!==manifest.observed.sha256)fail('Observation byte hash mismatch');
    const candidate=detector.compare(detector.decode(refBytes),detector.decode(obsBytes));
    if(sha(readBounded(detectorPath,1024*1024))!==integrity.detector_sha256)fail('Detector source changed during comparison');
    if(candidate.status==='INVALID')fail('Comparison input invalid: '+candidate.errors.map(e=>e.message).join('; '));
    if(!['PASS','ALARM'].includes(candidate.status))fail('Unexpected comparison status');
    integrity.verified=true;comparison=candidate;status=candidate.status;
  }catch(e){errors=[{code:'INVALID_RECORDING',message:e.message}];}
  let report={schema_version:1,envelope_version:VERSION,status,recording_id:recordingId,integrity,comparison,created_at:new Date().toISOString(),envelope_sha256:sha(fs.readFileSync(__filename))};
  if(errors)report.errors=errors;
  if(output){
    try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
    catch(e){report={...report,status:'INVALID',integrity:{...integrity,verified:false},comparison:null,errors:[{code:'OUTPUT_ERROR',message:e.message}]};}
  }
  const code=report.status==='PASS'?0:report.status==='ALARM'?1:2;
  (code===2?process.stderr:process.stdout).write(JSON.stringify({status:report.status,recording_id:report.recording_id,verified:report.integrity.verified,output,errors:report.errors})+'\n');
  return code;
}
if(require.main===module)process.exitCode=run(process.argv.slice(2));
module.exports={run,VERSION};
