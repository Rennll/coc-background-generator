import { getQuestionById, getQuestionOptions, validateAnswers, clearInvalidDependentAnswers, getActiveFlow } from "./lib/questionnaire.js";
import { buildCharacter, buildBackgroundText, buildFieldText, updateCharacterField } from "./lib/character.js";
import { exportJSON } from "./lib/export.js";
import { copyText, downloadText } from "./services/browser.js";
import { generateName } from "./lib/names.js";

const app = document.querySelector("#app");
const STORAGE_KEY = "coc-background-generator.progress.v1";
const VALID_NAME_CULTURES = ["taiwanHan", "japanese", "american"];
const state = { questions:null, templates:null, occupations:null, names:null, nameDataError:"", templatesPromise:null, occupationsPromise:null, namesPromise:null, selectedNameCulture:"taiwanHan", generatedNames:new Set(), nameClassification:null, pendingName:null, answers:{}, step:0, character:null, editing:null, error:"" };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const get = (url) => fetch(url).then(r => { if(!r.ok) throw new Error(`載入失敗：${url}`); return r.json(); });

function saveProgress(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      answers: state.answers,
      step: state.step,
      character: state.character,
      nameClassification: state.nameClassification,
      selectedNameCulture: state.selectedNameCulture
    }));
  } catch {
    // Storage can be unavailable in private browsing or when browser storage is full.
  }
}
function restoreProgress(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if(!saved || saved.version !== 1 || !saved.answers || typeof saved.answers !== "object") return;
    state.answers = { ...saved.answers };
    for(const questionId of state.questions.flow){
      if(!state.answers[questionId]) continue;
      if(!getQuestionOptions(questionId,state.answers,state.questions).some(option=>option.id===state.answers[questionId])){
        delete state.answers[questionId];
        state.answers = clearInvalidDependentAnswers(questionId,state.answers,state.questions);
      }
    }
    if(typeof state.answers.customOccupation !== "string") delete state.answers.customOccupation;
    const savedStep = Number.isInteger(saved.step) ? Math.max(0,saved.step) : 0;
    state.selectedNameCulture = VALID_NAME_CULTURES.includes(saved.selectedNameCulture) ? saved.selectedNameCulture : "taiwanHan";
    if(saved.character && typeof saved.character === "object" && saved.character.profile && saved.character.background){
      state.character = saved.character;
      if(saved.nameClassification && typeof saved.nameClassification.label === "string"){
        state.nameClassification = { label:saved.nameClassification.label, source:"generated", culture:String(saved.nameClassification.culture ?? "") };
      }
    }
    // Clamp the restored step after invalid answers have been removed from the active flow.
    state.step = Math.min(savedStep,Math.max(0,getActiveFlow(state.answers,state.questions).length-1));
  } catch {
    // Ignore malformed or unavailable saved state and start with a fresh questionnaire.
  }
}
async function loadTemplates(){
  if(state.templates) return state.templates;
  if(!state.templatesPromise) state.templatesPromise = get("./data/templates.json").then(data=>state.templates=data);
  return state.templatesPromise;
}
async function loadOccupations(){
  if(state.occupations) return state.occupations;
  if(!state.occupationsPromise) state.occupationsPromise = get("./data/occupations.json").then(data=>state.occupations=data);
  return state.occupationsPromise;
}
async function loadNames(){
  if(state.names) return state.names;
  if(!state.namesPromise) state.namesPromise = get("./data/names.json").then(data=>state.names=data).catch(e=>{state.nameDataError=e.message;return null;});
  return state.namesPromise;
}
async function init(){
  try {
    // Only the questionnaire data blocks the first interactive screen.
    state.questions = await get("./data/questions.json");
    restoreProgress();
    if(state.character){
      await loadTemplates();
      renderPreview();
    } else {
      renderQuestion();
    }
  } catch(e) {
    app.innerHTML = `<section class="panel"><h2>無法載入資料</h2><p>${esc(e.message)}</p><p>請使用本機 HTTP 靜態伺服器開啟，不要直接雙擊 index.html。</p></section>`;
  }
}
const flow = () => getActiveFlow(state.answers,state.questions);
function renderQuestion(){
  const steps=flow(); state.step=Math.min(state.step,Math.max(0,steps.length-1));
  const id=steps[state.step], q=getQuestionById(id,state.questions), opts=getQuestionOptions(id,state.answers,state.questions);
  const pct=Math.round((state.step+1)/steps.length*100);
  const custom=id==="Q10"&&state.answers.Q10==="other_custom" ? `<label class="field-label" for="customOccupation">請填寫具體職業</label><input class="input" id="customOccupation" maxlength="120" placeholder="例如：鐘錶匠" value="${esc(state.answers.customOccupation??"")}"><p class="muted">職業名稱會帶入預覽，之後仍可修改。</p>` : "";
  app.innerHTML=`<section class="panel"><div class="between"><span>問卷進度</span><span>${state.step+1} / ${steps.length} 個步驟</span></div><progress class="progress" max="100" value="${pct}" aria-label="問卷進度">${pct}%</progress><p class="eyebrow">${esc(id)}</p><h2 class="qtitle">${esc(q.title)}</h2><p class="muted">選擇一個最接近角色的答案。</p><div class="options">${opts.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o.id)}" ${state.answers[id]===o.id?"checked":""}><span>${esc(o.label)}</span></label>`).join("")}</div>${custom}${state.error?`<p class="error" role="alert">${esc(state.error)}</p>`:""}<div class="actions"><button class="btn" id="prev" ${state.step===0?"disabled":""}>上一題</button><button class="btn btn-primary" id="next">${state.step===steps.length-1?"產生背景":"下一題"}</button></div></section>`;
  app.querySelectorAll('input[name="answer"]').forEach(el=>el.addEventListener("change",e=>{state.answers[id]=e.target.value;state.answers=clearInvalidDependentAnswers(id,state.answers,state.questions);state.error="";saveProgress();renderQuestion();}));
  document.querySelector("#customOccupation")?.addEventListener("input",e=>{state.answers.customOccupation=e.target.value;state.error="";saveProgress();});
  document.querySelector("#prev").addEventListener("click",()=>{state.step--;state.error="";saveProgress();renderQuestion();});
  document.querySelector("#next").addEventListener("click",async()=>{
    if(!state.answers[id]){state.error="請先選擇一個答案。";return renderQuestion();}
    if(id==="Q10"&&state.answers.Q10==="other_custom"&&!String(state.answers.customOccupation??"").trim()){state.error="請填寫具體職業。";return renderQuestion();}
    if(state.step<flow().length-1){state.step++;state.error="";saveProgress();return renderQuestion();}
    const result=validateAnswers(state.answers,state.questions);
    if(!result.valid){state.error=result.errors[0].message;return renderQuestion();}
    try{
      await loadTemplates();
      state.character=buildCharacter(state.answers,state.templates,state.questions);
      state.editing=null;state.error="";saveProgress();renderPreview();
    }catch(e){state.error=e.message;renderQuestion();}
  });
}
function renderPreview(){
  const profile=state.templates.profileFields.map(f=>({...f,section:"profile"}));
  const background=Object.entries(state.templates.fieldLabels).map(([id,label])=>({id,label,section:"background",type:"textarea"}));
  const fields=[...profile,...background];
  app.innerHTML=`<section class="panel"><p class="eyebrow">INVESTIGATOR BACKGROUND</p><h2 class="qtitle">背景預覽</h2><p class="muted">所有欄位都會保留顯示。你可以修改或清空任何欄位。</p><div class="toolbar"><button class="btn btn-primary" id="copyAll">複製完整背景</button><button class="btn" id="export">匯出 JSON</button><button class="btn" id="restart">重新產生</button></div><div class="grid">${fields.map(f=>renderField(f)).join("")}</div><p class="notice">角色資料會自動保存在此瀏覽器；重要資料仍建議匯出 JSON 備份。</p>${state.error?`<p role="status">${esc(state.error)}</p>`:""}</section>`;
  for(const f of fields){
    const key=`${f.section}:${f.id}`;
    const beginEdit=async()=>{const isNameField=f.section==="profile"&&f.id==="name";if(f.section==="profile"&&f.id==="occupation"){try{await loadOccupations();}catch(e){state.error=`職業資料載入失敗：${e.message}`;renderPreview();return;}}if(isNameField){state.pendingName=null;await loadNames(); /* loadNames handles fetch errors and stores a user-facing message */}state.editing=key;if(isNameField)createNameCandidate();renderPreview();document.querySelector("#editor")?.focus();};
    document.querySelector(`[data-edit="${key}"]`)?.addEventListener("click",beginEdit);
    document.querySelector(`[data-edit-value="${key}"]`)?.addEventListener("click",beginEdit);
    document.querySelector(`[data-copy="${key}"]`)?.addEventListener("click",async()=>{const text=f.section==="profile"?String(state.character.profile[f.id]??""):buildFieldText(state.character,f.id);try{await copyText(text);state.error="已複製欄位內容。";}catch(e){state.error=`複製失敗：${e.message}`;}renderPreview();});
    if(f.section==="profile"&&f.id==="occupation") document.querySelector("#occupation-select")?.addEventListener("change",event=>{const wrap=document.querySelector("#occupation-custom-wrap");if(wrap)wrap.hidden=event.target.value!=="other_custom";});
    document.querySelector(`[data-save="${key}"]`)?.addEventListener("click",()=>{try{
      let value=document.querySelector("#editor")?.value ?? "";
      if(f.section==="profile"&&f.id==="occupation"){
        const selected=document.querySelector("#occupation-select")?.value ?? "";
        if(selected==="other_custom") value=document.querySelector("#occupation-custom")?.value.trim() ?? "";
        else if(selected==="") value="";
        else value=state.occupations.occupations.find(o=>o.id===selected)?.name ?? "";
      }
      if(f.section==="profile"&&f.id==="name"){const previousName=String(state.character.profile.name??"");value=String(value).trim();if(value!==previousName)state.nameClassification=null;state.pendingName=null;}state.character=updateCharacterField(state.character,f.section,f.id,value);state.editing=null;state.error="";saveProgress();
    }catch(e){state.error=e.message;}renderPreview();});
    document.querySelector(`[data-cancel="${key}"]`)?.addEventListener("click",()=>{state.editing=null;state.error="";renderPreview();});
  }
  // Updates candidate/error state only; callers control when the preview is rendered.
  const createNameCandidate=()=>{try{if(!state.names)throw new Error(state.nameDataError||"姓名資料尚未載入");state.pendingName=generateName(state.names,{excludeNames:state.generatedNames,culture:state.selectedNameCulture});state.generatedNames.add(state.pendingName.name);state.error="";}catch(e){state.pendingName=null;state.error=`無法產生姓名：${e.message}`;}};
  document.querySelector("[data-name-culture]")?.addEventListener("change",event=>{state.selectedNameCulture=event.target.value;createNameCandidate();renderPreview();});
  document.querySelector("[data-name-reroll]")?.addEventListener("click",()=>{createNameCandidate();renderPreview();});
  document.querySelector("[data-name-cancel]")?.addEventListener("click",()=>{state.pendingName=null;state.error="";renderPreview();});
  document.querySelector("[data-name-confirm]")?.addEventListener("click",()=>{if(!state.pendingName)return;state.character=updateCharacterField(state.character,"profile","name",state.pendingName.name);state.nameClassification={label:state.pendingName.label,source:"generated",culture:state.pendingName.culture};state.pendingName=null;state.editing=null;state.error="";saveProgress();renderPreview();});
  document.querySelector("#copyAll").addEventListener("click",async()=>{try{await copyText(buildBackgroundText(state.character,state.templates));state.error="已複製完整背景。";}catch(e){state.error=`複製失敗：${e.message}`;}renderPreview();});
  document.querySelector("#export").addEventListener("click",()=>{downloadText("coc-investigator-background.json",exportJSON(state.character,new Date().toISOString()),"application/json;charset=utf-8");state.error="已匯出 JSON。";renderPreview();});
  document.querySelector("#restart").addEventListener("click",()=>{if(confirm("重新產生會清除問卷答案與手動編輯。確定要重新開始嗎？"))reset();});
}
function renderField(f){
  const value=f.section==="profile"?state.character.profile[f.id]:state.character.background[f.id];
  const display=value==null?"":String(value),key=`${f.section}:${f.id}`,editing=state.editing===key;
  const isName=f.section==="profile"&&f.id==="name";
  const nameMeta=isName&&state.nameClassification? `<p class="name-classification" data-name-classification>${esc(state.nameClassification.label)}</p>`:"";
  const nameActions=isName&&editing? `<div class="name-tools"><label class="name-culture-control" for="name-culture-${f.id}">姓名文化<select class="input" id="name-culture-${f.id}" data-name-culture><option value="taiwanHan" ${state.selectedNameCulture==="taiwanHan"?"selected":""}>台灣漢人</option><option value="japanese" ${state.selectedNameCulture==="japanese"?"selected":""}>日本</option><option value="american" ${state.selectedNameCulture==="american"?"selected":""}>美國（1920年代）</option></select></label></div>${state.pendingName?`<div class="name-candidate" role="group" aria-label="姓名候選"><p><strong>候選姓名：</strong><span data-name-candidate>${esc(state.pendingName.name)}</span></p><p class="muted">${esc(state.pendingName.cultureLabel)} · ${esc(state.pendingName.label)}</p><div class="actions"><button class="btn" data-name-cancel type="button">取消</button><button class="btn" data-name-reroll type="button">重新抽取</button><button class="btn btn-primary" data-name-confirm type="button">確認套用</button></div></div>`:""}`:"";
  return `<article class="field ${f.section==="background"?"full":""}"><div class="field-head"><h3>${esc(f.label)}</h3><div><button class="small" data-copy="${key}" aria-label="複製欄位：${esc(f.label)}" type="button">複製欄位</button> <button class="small" data-edit="${key}" aria-label="編輯：${esc(f.label)}" type="button">${editing?"編輯中":"編輯"}</button></div></div>${editing?`${f.section==="profile"&&f.id==="occupation"?occupationEditor(display):f.id==="age"?`<input id="editor" class="input" aria-label="${esc(f.label)}" type="number" min="0" step="1" value="${esc(display)}">`:f.section==="background"?`<textarea id="editor" class="area" aria-label="${esc(f.label)}">${esc(display)}</textarea>`:`<input id="editor" class="input" aria-label="${esc(f.label)}" value="${esc(display)}">`}<div class="actions"><button class="btn" data-cancel="${key}" aria-label="取消編輯：${esc(f.label)}">取消</button><button class="btn btn-primary" data-save="${key}" aria-label="儲存：${esc(f.label)}">儲存</button></div>`:`<button class="value value-button ${display===""?"empty":""}" data-edit-value="${key}" aria-label="編輯欄位：${esc(f.label)}" type="button">${display===""?"尚未填寫":esc(display)}</button>`}${nameMeta}${nameActions}</article>`;
}
function occupationEditor(display){
  const known=state.occupations.occupations.find(o=>o.name===display),selected=known?.id ?? (display?"other_custom":"");
  const categories={education_research:"教育與研究",media_communication:"媒體與傳播",investigation_law:"調查與法律",health_care:"醫療與照護",business_trade:"商業與貿易",technical_manual:"技術與實務",transport:"交通運輸",arts_entertainment:"藝術與娛樂",other_livelihood:"其他生活來源",outdoors:"戶外與探險",service:"服務業",religion:"宗教",crime:"犯罪與地下活動",labor:"勞動與採掘",government:"政府與公共事務",public_service:"公共服務",military:"軍事",office:"辦公與行政",occult:"神秘學",community:"社群與文化",animal_care:"動物照護"},grouped={};
  for(const o of state.occupations.occupations){(grouped[o.category]??=[]).push(o);}
  const groups=Object.entries(grouped).map(([category,items])=>`<optgroup label="${esc(categories[category]??category)}">${items.map(o=>`<option value="${esc(o.id)}" ${selected===o.id?"selected":""}>${esc(o.name)}（${esc(o.englishCandidate)}）</option>`).join("")}</optgroup>`).join("");
  return `<label class="field-label" for="occupation-select">選擇職業</label><select id="occupation-select" class="input"><option value="" ${selected===""?"selected":""}>不設定職業</option>${groups}<option value="other_custom" ${selected==="other_custom"?"selected":""}>其他：自行填寫職業</option></select><p class="muted">依分類選擇職業，或自行填寫清單以外的職業。括號內為英文原名。</p><div id="occupation-custom-wrap" ${selected==="other_custom"?"":"hidden"}><label class="field-label" for="occupation-custom">自訂職業名稱</label><input id="occupation-custom" class="input" value="${selected==="other_custom"?esc(display):""}" placeholder="例如：鐘錶匠" maxlength="120"></div>`;
}
function reset(){state.answers={};state.step=0;state.character=null;state.editing=null;state.error="";state.generatedNames.clear();state.nameClassification=null;state.pendingName=null;try{localStorage.removeItem(STORAGE_KEY);}catch{
  // Ignore errors when browser storage is unavailable or restricted.
}renderQuestion();}
init();
