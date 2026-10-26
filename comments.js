(()=>{'use strict';
const API='https://sladek-komentare.frantisekdron.chatgpt.site/api/comments';
const prefix='sladek-comments-v1:';let records=[],syncing=false;
const memory={};const get=k=>{try{return localStorage.getItem(prefix+k)||memory[k]||null}catch{return memory[k]||null}};const put=(k,v)=>{memory[k]=v;try{localStorage.setItem(prefix+k,v)}catch{}};
const key=get('editKey')||crypto.randomUUID();put('editKey',key);let name=get('name')||'';
const drafts=JSON.parse(get('drafts')||'{}'),owned=JSON.parse(get('owned')||'[]');const timers=new Map(),inflight=new Map();const boxes=[];
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const persist=()=>{put('drafts',JSON.stringify(drafts));put('owned',JSON.stringify(owned))};
const namebar=el('div','comment-name');const label=el('label',null,'Vaše jméno pro komentáře');const input=el('input');input.id='comment-author';input.autocomplete='name';input.maxLength=60;input.value=name;input.placeholder='Např. Petr';label.htmlFor=input.id;namebar.append(label,input,el('p','muted','Komentáře jsou veřejné. Text se automaticky uloží po krátké pauze v psaní a uvidí ho i ostatní návštěvníci.'));
document.querySelector('header').append(namebar);
function draft(topic){if(!drafts[topic])drafts[topic]={id:crypto.randomUUID(),body:'',revision:0,saved:0};return drafts[topic]}
function status(topic,message){for(const b of boxes)if(b.topic===topic)b.status.textContent=message}
function queue(topic){clearTimeout(timers.get(topic));timers.set(topic,setTimeout(()=>save(topic),900))}
async function save(topic,keepalive=false){
 const d=draft(topic);if(!name.trim()){status(topic,'Nejprve vyplňte jméno.');return false}if(d.revision===d.saved)return true;
 if(inflight.has(topic)){await inflight.get(topic);if(d.revision!==d.saved)return save(topic,keepalive);return true}
 const version=d.revision;status(topic,'Ukládám…');const task=(async()=>{try{
 const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id,topic,editKey:key,name:name.trim(),body:d.body,revision:version}),keepalive});const data=await res.json();if(!res.ok)throw Error(data.error||'Uložení se nezdařilo.');
 if(!owned.includes(d.id))owned.push(d.id);d.saved=version;persist();status(topic,d.revision===version?'Uloženo · viditelné všem':'Ukládám další změny…');return true;
 }catch(e){status(topic,'Neuloženo — '+e.message+' Zkusíme znovu.');return false}})();inflight.set(topic,task);const ok=await task;inflight.delete(topic);if(ok){refresh();if(d.revision!==d.saved)queue(topic)}return ok;
}
function render(b){
 b.list.replaceChildren();const list=records.filter(r=>r.topic===b.topic);b.heading.textContent='Komentáře'+(list.length?' ('+list.length+')':'');
 for(const r of list){const card=el('article','comment-item');const meta=el('div','comment-meta');meta.append(el('strong',null,r.name),el('time',null,new Date(r.created_at).toLocaleString('cs-CZ',{dateStyle:'short',timeStyle:'short'})));card.append(meta,el('p','comment-body',r.body));if(owned.includes(r.id)){const edit=el('button','comment-edit','Upravit svůj komentář');edit.type='button';edit.onclick=()=>{const d=draft(b.topic);if(d.revision!==d.saved&&d.body){status(b.topic,'Nejdřív počkejte na uložení rozepsaného komentáře.');return}drafts[b.topic]={id:r.id,body:r.body,revision:r.revision,saved:r.revision};persist();b.textarea.value=r.body;b.textarea.focus();status(b.topic,'Úpravy se automaticky uloží. Vymazáním textu komentář skryjete.');};card.append(edit)}b.list.append(card)}
 if(!list.length)b.list.append(el('p','muted','Zatím bez komentáře.'));
}
function setTopic(b,topic){if(b.topic===topic)return;b.topic=topic;const d=draft(topic);b.textarea.value=d.body;b.status.textContent=d.revision!==d.saved?'Čeká na uložení…':d.body?'Uloženo · viditelné všem':'';render(b)}
for(const host of document.querySelectorAll('[data-comment-topic]')){
 const wrap=el('details','comment-panel');const heading=el('summary',null,'Komentáře');const list=el('div','comment-list');const textarea=el('textarea');textarea.rows=3;textarea.maxLength=4000;textarea.placeholder=name?'Napište komentář…':'Nejprve vyplňte své jméno nahoře';textarea.disabled=!name.trim();textarea.setAttribute('aria-label','Komentář k tomuto obrázku');const s=el('p','comment-status');s.setAttribute('role','status');const next=el('button','comment-next','Další komentář');next.type='button';
 const b={host,wrap,heading,list,textarea,status:s,topic:null};boxes.push(b);setTopic(b,host.dataset.commentTopic);
 textarea.oninput=()=>{const d=draft(b.topic);d.body=textarea.value;d.revision++;persist();status(b.topic,'Čeká na uložení…');queue(b.topic)};textarea.onblur=()=>save(b.topic);
 next.onclick=async()=>{if(!await save(b.topic))return;drafts[b.topic]={id:crypto.randomUUID(),body:'',revision:0,saved:0};persist();textarea.value='';s.textContent='';textarea.focus()};
 wrap.append(heading,list,textarea,s,next);host.append(wrap);
}
input.oninput=()=>{name=input.value;put('name',name);for(const b of boxes){b.textarea.disabled=!name.trim();b.textarea.placeholder=name.trim()?'Napište komentář…':'Nejprve vyplňte své jméno nahoře';if(name.trim()&&draft(b.topic).revision!==draft(b.topic).saved)queue(b.topic)}};
async function refresh(){if(syncing)return;syncing=true;try{const res=await fetch(API,{cache:'no-store'});if(!res.ok)throw Error();const data=await res.json();records=data.comments;for(const b of boxes)render(b)}catch{for(const b of boxes)if(!b.status.textContent)b.status.textContent='Komentáře se nepodařilo načíst. Obnovíme spojení.'}finally{syncing=false}}
window.addEventListener('stylechange',()=>{for(const b of boxes){if(b.host.classList.contains('room')){const style=b.host.querySelector('[data-style][aria-pressed="true"]').dataset.style;setTopic(b,'room:'+b.host.id+':'+style)}}});
window.addEventListener('pagehide',()=>{for(const topic of Object.keys(drafts))if(drafts[topic].revision!==drafts[topic].saved)save(topic,true)});
window.addEventListener('online',()=>{refresh();for(const t of Object.keys(drafts))if(drafts[t].revision!==drafts[t].saved)save(t)});
setInterval(()=>{if(!document.hidden){refresh();for(const t of Object.keys(drafts))if(drafts[t].revision!==drafts[t].saved)save(t)}},10000);refresh();
})();
