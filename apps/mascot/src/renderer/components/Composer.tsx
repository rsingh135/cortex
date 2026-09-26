import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { streamSpeech, type VoicePhase } from '../lib/realtime';
interface Props { disabled:boolean; mode:'remember'|'ask'; onSubmit:(text:string)=>Promise<boolean>; onListen:(active:boolean)=>void; onError:(message:string)=>void }
export function Composer({disabled,mode,onSubmit,onListen,onError}:Props) {
  const [text,setText]=useState('');
  const [recording,setRecording]=useState(false);
  const [transcribing,setTranscribing]=useState(false);
  const [phase,setPhase]=useState<VoicePhase>('connecting');
  const active=useRef(false),recordingJob=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current=false;};},[]);
  const submit=async(event:FormEvent|KeyboardEvent)=>{event.preventDefault();if(!text.trim()||disabled||recording||transcribing)return;if(await onSubmit(text.trim()))setText('');};
  const toggleRecording=async()=>{
    if(active.current){active.current=false;return;}
    if(disabled||transcribing||recordingJob.current)return;
    recordingJob.current=true;active.current=true;setPhase('connecting');setRecording(true);onListen(true);
    try {
      const previous=text.trim();
      await streamSpeech(()=>active.current,transcript=>{if(mounted.current)setText([previous,transcript].filter(Boolean).join('\n'));},next=>{if(!mounted.current)return;setPhase(next);setTranscribing(next==='finishing');setRecording(next!=='finishing');});
    }catch(error){if(mounted.current)onError(error instanceof Error?error.message:String(error));}
    finally{recordingJob.current=false;active.current=false;if(mounted.current){setRecording(false);setTranscribing(false);onListen(false);}}
  };
  return <form onSubmit={event=>void submit(event)} className="composer">
    <label htmlFor="memory-text">{mode==='remember'?'A little thought worth keeping':'What’s on your mind?'}</label>
    <textarea id="memory-text" value={text} onChange={event=>setText(event.target.value)} placeholder={mode==='remember'?'Remember that I prefer quiet cafés…':'What do you remember about me?'} maxLength={10000} readOnly={recording||transcribing} disabled={disabled&&!recording&&!transcribing} rows={3} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter')void submit(event);}}/>
    <div className="composer-actions"><button type="button" className={`voice-button ${recording?'recording':''}`} disabled={transcribing||(disabled&&!recording)} onClick={()=>void toggleRecording()} aria-pressed={recording} aria-label={recording?'Stop recording':'Record a voice memory'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>{recording?phase==='connecting'?'Cancel':'Stop recording':transcribing?'Finishing…':'Use voice'}</button><button className="save-button" disabled={disabled||recording||transcribing||!text.trim()}>{mode==='remember'?'Keep memory':'Ask Cortex'}<span aria-hidden="true">↗</span></button></div>
    <p className="composer-hint">{recording?phase==='connecting'?'Connecting microphone and live transcription…':'Live transcription · words appear as you speak · 60s max':transcribing?'Finishing the last words…':'Speak and watch your words appear. Review before sending.'}</p>
  </form>;
}
