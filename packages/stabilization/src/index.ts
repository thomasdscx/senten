import type { ApplicationIR } from '../../core/src/index.js';
export interface CompatibilityReport { compatible:boolean; irSchema:string; supportedIrSchemas:string[]; warnings:string[]; contracts:{commandSchema:string;extensionProtocol:string;registryProtocol:string;stateSchema:string}; }
export function compatibilityReport(ir:ApplicationIR,stateSchema='10'):CompatibilityReport{
  const supported=['0.1']; const warnings:string[]=[];
  if(!supported.includes(ir.schemaVersion))warnings.push(`Unsupported Application IR schema ${ir.schemaVersion}`);
  return{compatible:warnings.length===0,irSchema:ir.schemaVersion,supportedIrSchemas:supported,warnings,contracts:{commandSchema:'1.0-rc1',extensionProtocol:'1.0-rc1',registryProtocol:'1.0-rc1',stateSchema}};
}
