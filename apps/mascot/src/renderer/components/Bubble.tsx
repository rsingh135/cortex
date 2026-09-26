import type { AskResponse } from '@cortex/schema';
export function Bubble({answer,error,thinking}:{answer:AskResponse|null;error:string|null;thinking:boolean}) {
  if(!answer&&!error&&!thinking)return null;
  return <div className={`bubble ${error?'error':''}`}>{thinking?<p>One little moment…</p>:error?<p role="alert">{error}</p>:answer&&<><p>{answer.answer}</p><small>{answer.cited.length} {answer.cited.length===1?'memory':'memories'} used</small></>}</div>;
}
