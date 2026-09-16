import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { crawlWebsite, extractHtmlInteractions, interactionToSemantic } from '../packages/interaction/src/index.js';
import type { ApplicationIR } from '../packages/core/src/index.js';

test('extractHtmlInteractions discovers links and controls',()=>{
  const result=extractHtmlInteractions('<a href="/next">Next</a><button>Save</button><form action="/submit"><input name="email"></form>','http://localhost/start');
  assert.equal(result.links.length,1);
  assert.equal(result.links[0]?.href,'http://localhost/next');
  assert.equal(result.actions.filter(a=>a.kind==='button').length,1);
  assert.equal(result.actions.filter(a=>a.kind==='form').length,1);
  assert.equal(result.actions.filter(a=>a.kind==='input').length,1);
});

test('crawlWebsite maps pages, broken links and interactions',async()=>{
  const server=createServer((req,res)=>{
    if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});res.end('<title>Home</title><a href="/about">About</a><a href="/missing">Missing</a><button>Open</button>');return;}
    if(req.url==='/about'){res.writeHead(200,{'content-type':'text/html'});res.end('<title>About</title><a href="/">Home</a>');return;}
    res.writeHead(404,{'content-type':'text/html'});res.end('<title>Not Found</title>');
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const addr=server.address(); assert.ok(addr&&typeof addr==='object');
  const base=`http://127.0.0.1:${addr.port}/`;
  try{
    const result=await crawlWebsite(base,{maxPages:10});
    assert.equal(result.run.pages,3);
    assert.ok(result.nodes.some(n=>n.kind==='button'));
    assert.ok(result.findings.some(f=>f.kind==='broken-page'));
    assert.equal(result.run.status,'failed');
  }finally{server.close();await once(server,'close');}
});

test('interaction evidence links observed runtime routes into StateTruss',async()=>{
  const server=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<title>Home</title>');});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const addr=server.address(); assert.ok(addr&&typeof addr==='object');
  try{
    const result=await crawlWebsite(`http://127.0.0.1:${addr.port}/`,{maxPages:1});
    const ir:ApplicationIR={schemaVersion:'0.1',application:{id:'app',name:'App'},nodes:[{id:'route:/',kind:'route',label:'/'}],edges:[],generatedAt:new Date().toISOString()};
    const next=interactionToSemantic(result,ir);
    assert.ok(next.nodes.some(n=>n.kind==='evidence'&&n.metadata?.runId===result.run.id));
    assert.ok(next.edges.some(e=>e.relation==='observes'&&e.to==='route:/'));
  }finally{server.close();await once(server,'close');}
});
