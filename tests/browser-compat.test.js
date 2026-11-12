import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import ts from 'typescript';

const code=()=>ts.transpileModule(readFileSync(new URL('../src/browser-compat.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function legacy(){const context={AbortSignal:{},AbortController};vm.runInNewContext(code(),context);return context.AbortSignal;}

test('older browsers compose cancellation and preserve the first abort reason',()=>{
  const api=legacy(),a=new AbortController(),b=new AbortController();
  const signal=api.any([a.signal,b.signal]);let calls=0;signal.addEventListener('abort',()=>calls++);
  assert.equal(signal.aborted,false);b.abort('second');a.abort('first');
  assert.equal(signal.aborted,true);assert.equal(signal.reason,'second');assert.equal(calls,1);
});
test('already aborted and empty input behave like native composition',()=>{
  const api=legacy(),a=new AbortController();a.abort('already');
  assert.equal(api.any([a.signal]).reason,'already');assert.equal(api.any([]).aborted,false);
});
test('composed cancellation still aborts a fetch response body after headers arrive',async t=>{
  const server=http.createServer((req,res)=>{res.writeHead(200);res.write('media');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const api=legacy(),a=new AbortController(),b=new AbortController();
  const response=await fetch(`http://127.0.0.1:${server.address().port}`,{signal:api.any([a.signal,b.signal])});
  const body=response.text();b.abort();
  await assert.rejects(body,{name:'AbortError'});
});
test('native composition remains untouched',()=>{
  const native=AbortSignal.any,context={AbortSignal:{any:native},AbortController};
  vm.runInNewContext(code(),context);assert.equal(context.AbortSignal.any,native);
});
