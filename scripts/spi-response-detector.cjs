'use strict';
// Defensive offline comparison only. No device I/O or trigger signatures.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const VERSION='1.1.0';
const MAX_BYTES=16*1024*1024, MAX_RECORDS=100000;
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function invalid(code,message){return {schema_version:1,detector_version:VERSION,status:'INVALID',summary:null,alarms:[],errors:[{code,message}]};}
function fail(message){throw new Error(message);}

// JSON.parse alone silently accepts repeated object keys. This small parser
// validates the same JSON grammar and rejects repeated decoded key names.
function parseStrictJSON(text,nodeLimit=400010){
  if(!Number.isInteger(nodeLimit)||nodeLimit<1||nodeLimit>400010)fail('Invalid parser node budget');
  let pos=0,nodes=0;
  const ws=()=>{while(pos<text.length&&/[\x20\t\r\n]/.test(text[pos]))pos++;};
  function string(){
    if(text[pos]!== '"')fail('Expected JSON string');
    const start=pos++;
    while(pos<text.length){
      const c=text[pos++];
      if(c==='"')return JSON.parse(text.slice(start,pos));
      if(c==='\\'){if(pos>=text.length)fail('Unterminated JSON escape');pos++;}
    }
    fail('Unterminated JSON string');
  }
  function value(depth){
    if(++nodes>nodeLimit)fail('JSON value count exceeds parser budget');
    if(depth>64)fail('JSON nesting exceeds 64 levels');
    ws(); const c=text[pos];
    if(c==='"')return string();
    if(c==='{'){
      pos++;ws();const result=Object.create(null),keys=new Set();
      if(text[pos]==='}'){pos++;return result;}
      for(;;){
        ws();const key=string();if(keys.has(key))fail('Duplicate JSON object key');keys.add(key);
        ws();if(text[pos++]!==':')fail('Expected JSON colon');
        result[key]=value(depth+1);ws();const end=text[pos++];
        if(end==='}')return result;
        if(end!==',')fail('Expected JSON comma or closing brace');
      }
    }
    if(c==='['){
      pos++;ws();const result=[];
      if(text[pos]===']'){pos++;return result;}
      for(;;){
        result.push(value(depth+1));ws();const end=text[pos++];
        if(end===']')return result;
        if(end!==',')fail('Expected JSON comma or closing bracket');
      }
    }
    for(const [literal,result] of [['true',true],['false',false],['null',null]]){
      if(text.startsWith(literal,pos)){pos+=literal.length;return result;}
    }
    const match=text.slice(pos).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if(match){pos+=match[0].length;return JSON.parse(match[0]);}
    fail('Invalid JSON value');
  }
  const result=value(0);ws();if(pos!==text.length)fail('Trailing JSON content');return result;
}

function exactFields(object,names,label){
  if(object===null||typeof object!=='object'||Array.isArray(object))fail(label+' must be an object');
  const keys=Object.keys(object);
  if(keys.length!==names.length||names.some(n=>!Object.hasOwn(object,n)))fail(label+' has missing or unknown fields');
}
function validate(document,kind){
  exactFields(document,['schema_version','transactions'],kind);
  if(document.schema_version!==1)fail(kind+' schema_version must equal 1');
  const rows=document.transactions;
  if(!Array.isArray(rows)||rows.length>MAX_RECORDS)fail(kind+' transactions must be an array of at most '+MAX_RECORDS+' records');
  if(kind==='reference'&&rows.length===0)fail('Reference must not be empty');
  const field=kind==='reference'?'expected':'observed',map=new Map();
  for(const [index,row] of rows.entries()){
    exactFields(row,['id',field],kind+' record '+index);
    if(typeof row.id!=='string'||row.id.length<1||row.id.length>128||row.id.trim()!==row.id||/[\x00-\x1f\x7f]/.test(row.id))fail(kind+' record '+index+' has invalid id');
    if(map.has(row.id))fail(kind+' has duplicate transaction id');
    if(typeof row[field]!=='string'||!/^[0-9a-fA-F]{8}$/.test(row[field]))fail(kind+' record '+index+' must contain exactly eight hexadecimal digits');
    map.set(row.id,row[field].toLowerCase());
  }
  return map;
}
function compare(reference,observed){
  try{
    const expected=validate(reference,'reference'),actual=validate(observed,'observed');
    const summary={reference_records:expected.size,observed_records:actual.size,matched:0,mismatched:0,missing:0,unexpected:0};
    const alarms=[];
    for(const [id,word] of expected){
      if(!actual.has(id)){summary.missing++;alarms.push({type:'missing_transaction',id,expected:word});continue;}
      const got=actual.get(id);
      if(word===got){summary.matched++;continue;}
      summary.mismatched++;
      const xor=(parseInt(word,16)^parseInt(got,16))>>>0;
      const bits=Array.from({length:32},(_,i)=>i).filter(i=>((xor>>>i)&1)!==0);
      alarms.push({type:'value_mismatch',id,expected:word,observed:got,differing_bits_lsb0:bits});
    }
    for(const [id,word] of actual)if(!expected.has(id)){summary.unexpected++;alarms.push({type:'unexpected_transaction',id,observed:word});}
    return {schema_version:1,detector_version:VERSION,status:alarms.length?'ALARM':'PASS',summary,alarms};
  }catch(e){return invalid('INVALID_DOCUMENT',e.message);}
}

function readBytes(file){
  const fd=fs.openSync(file,'r');
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile())fail('Input must be a regular file');
    if(stat.size>MAX_BYTES)fail('Input exceeds 16 MiB');
    // Allocate for the observed size plus one growth sentinel, instead of
    // reserving 16 MiB for small inputs. Size-changing captures fail closed.
    const buffer=Buffer.alloc(stat.size+1);let used=0;
    while(used<buffer.length){const n=fs.readSync(fd,buffer,used,buffer.length-used,null);if(n===0)break;used+=n;}
    if(used!==stat.size||fs.fstatSync(fd).size!==stat.size)fail('Input size changed during reading');
    return buffer.subarray(0,used);
  }finally{fs.closeSync(fd);}
}
function decode(bytes){
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  return parseStrictJSON(text);
}
function cli(argv){
  let report,output;
  const inputs={reference_sha256:null,observed_sha256:null,pinned_reference_sha256:null};
  try{
    const allowed=new Set(['--reference','--reference-sha256','--observed','--output']),options=new Map();
    if(argv.length!==8)fail('Expected --reference FILE --reference-sha256 HASH --observed FILE --output NEW_FILE');
    for(let i=0;i<argv.length;i+=2){
      if(!allowed.has(argv[i])||options.has(argv[i])||!argv[i+1])fail('Unknown, duplicate, or missing CLI option');
      options.set(argv[i],argv[i+1]);
    }
    for(const name of allowed)if(!options.has(name))fail('Missing required CLI option');
    const pin=options.get('--reference-sha256');
    if(!/^[a-fA-F0-9]{64}$/.test(pin))fail('Reference pin must be a 64-digit SHA-256');
    inputs.pinned_reference_sha256=pin.toLowerCase();
    output=path.resolve(options.get('--output'));
    const referencePath=path.resolve(options.get('--reference')),observedPath=path.resolve(options.get('--observed'));
    if(output===referencePath||output===observedPath||fs.existsSync(output)){output=null;fail('Output must be a new file distinct from inputs');}
    const refBytes=readBytes(referencePath);inputs.reference_sha256=digest(refBytes);
    if(inputs.reference_sha256!==inputs.pinned_reference_sha256)fail('Reference SHA-256 does not match pinned value');
    const observedBytes=readBytes(observedPath);inputs.observed_sha256=digest(observedBytes);
    report=compare(decode(refBytes),decode(observedBytes));
  }catch(e){report=invalid('INVALID_INPUT',e.message);}
  report={...report,created_at:new Date().toISOString(),inputs,detector_sha256:digest(fs.readFileSync(__filename))};
  if(output){
    try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
    catch(e){report={...invalid('OUTPUT_ERROR',e.message),inputs,detector_sha256:report.detector_sha256};}
  }
  const code=report.status==='PASS'?0:report.status==='ALARM'?1:2;
  const summary=JSON.stringify({status:report.status,output:output||null,summary:report.summary,errors:report.errors});
  (code===2?process.stderr:process.stdout).write(summary+'\n');
  return code;
}
module.exports={compare,parseStrictJSON,VERSION,readBytes,decode};
if(require.main===module)process.exitCode=cli(process.argv.slice(2));
