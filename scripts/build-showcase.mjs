import { exportScenarioArtifacts } from '../dist/packages/scenario-lab/src/index.js';
const root=process.cwd();const out=new URL('../apps/showcase/data/',import.meta.url).pathname;
const result=await exportScenarioArtifacts(root,out);
console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;
