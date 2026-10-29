
import React,{useEffect,useMemo,useRef,useState} from 'react'
import {ShieldCheck,LockKeyhole,Files,Scissors,Minimize2,RotateCw,Stamp,Images,FileImage,ArrowUpDown,Layers3,Hash,Upload,Download,X,ChevronRight,CheckCircle2,Menu,Sparkles,ArrowRight,FileText,LoaderCircle,Plus,AlertTriangle,Eye,Trash2} from 'lucide-react'
import {processPdf,renderPdfPages,renderPdfThumbnails,downloadBlob,safeName,formatBytes} from './pdfTools.js'

const TOOLS=[
{id:'merge',name:'Merge PDF',desc:'Combine documents in seconds',icon:Files,group:'Organize',accepts:'.pdf',multi:true},
{id:'split',name:'Split PDF',desc:'Create custom parts or one PDF per page',icon:Scissors,group:'Organize',accepts:'.pdf'},
{id:'extract',name:'Extract pages',desc:'Create a PDF from chosen pages',icon:Layers3,group:'Organize',accepts:'.pdf'},
{id:'reorder',name:'Reorder pages',desc:'Drag pages into a new sequence',icon:ArrowUpDown,group:'Organize',accepts:'.pdf'},
{id:'rotate',name:'Rotate PDF',desc:'Rotate selected pages',icon:RotateCw,group:'Edit',accepts:'.pdf'},
{id:'watermark',name:'Watermark PDF',desc:'Add a text watermark',icon:Stamp,group:'Edit',accepts:'.pdf'},
{id:'numbers',name:'Add page numbers',desc:'Number pages automatically',icon:Hash,group:'Edit',accepts:'.pdf'},
{id:'compress',name:'Compress PDF',desc:'Create a smaller image-based PDF',icon:Minimize2,group:'Optimize',accepts:'.pdf'},
{id:'images',name:'Images to PDF',desc:'Turn JPG and PNG files into a PDF',icon:Images,group:'Convert',accepts:'.jpg,.jpeg,.png',multi:true},
{id:'toimages',name:'PDF to images',desc:'Export pages as PNG images',icon:FileImage,group:'Convert',accepts:'.pdf'}
]

const defaultOptions=()=>({pages:'1-3',rotation:'90',watermark:'CONFIDENTIAL',prefix:'',splitMode:'groups'})

export default function App(){
  const [themePreference,setThemePreference]=useState(()=>{
    try{return localStorage.getItem('privpdf-theme')||'system'}
    catch{return 'system'}
  })

  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme=()=>{
      const resolvedTheme=themePreference==='system'
        ?(media.matches?'dark':'light')
        :themePreference

      document.documentElement.dataset.theme=resolvedTheme
    }

    applyTheme()
    media.addEventListener?.('change',applyTheme)
    return ()=>media.removeEventListener?.('change',applyTheme)
  },[themePreference])

  const [active,setActive]=useState(null),[files,setFiles]=useState([]),[options,setOptions]=useState(defaultOptions),[busy,setBusy]=useState(false),[error,setError]=useState(''),[menuOpen,setMenuOpen]=useState(false),[view,setView]=useState('upload'),[thumbnails,setThumbnails]=useState([]),[thumbBusy,setThumbBusy]=useState(false),[selected,setSelected]=useState([]),[groups,setGroups]=useState([]),[results,setResults]=useState([]),[dragIndex,setDragIndex]=useState(null)

  const inputRef=useRef(null),activeTool=TOOLS.find(t=>t.id===active),totalBytes=useMemo(()=>files.reduce((n,f)=>n+f.size,0),[files])

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setThumbnails([])
      setSelected([])
      if(!files.length||!active||active==='images')return
      setThumbBusy(true)
      try{
        const pages=await renderPdfThumbnails(files[0])
        if(!cancelled){setThumbnails(pages);setSelected(pages.map((_,i)=>i))}
      }catch(e){
        if(!cancelled)setError(e?.message||'Could not preview this PDF.')
      }finally{
        if(!cancelled)setThumbBusy(false)
      }
    }
    load()
    return()=>{cancelled=true}
  },[files,active])

  function home(){
    setActive(null);setFiles([]);setResults([]);setThumbnails([]);setError('');setView('upload')
    history.replaceState({},'','#tools')
  }

  function chooseTool(id){
    setActive(id);setFiles([]);setError('');setResults([]);setView('upload')
    setOptions(defaultOptions());setGroups([]);setThumbnails([]);setSelected([]);setMenuOpen(false)
    history.replaceState({},'',`#${id}`)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  function addFiles(list){
    const picked=Array.from(list||[])
    if(!picked.length)return
    const tool=TOOLS.find(t=>t.id===active)
    const accepted=tool?.id==='images'
      ?picked.filter(f=>/image\/(png|jpeg)/.test(f.type)||/\.(png|jpe?g)$/i.test(f.name))
      :picked.filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name))
    if(accepted.length!==picked.length)setError(tool?.id==='images'?'Only PNG and JPG images are supported.':'Choose PDF files only.')
    setFiles(old=>tool?.multi?[...old,...accepted]:accepted.slice(0,1))
    setGroups([]);setResults([]);setView('upload')
  }

  function togglePage(i){
    setSelected(old=>old.includes(i)?old.filter(n=>n!==i):[...old,i].sort((a,b)=>a-b))
  }

  function addGroup(){
    if(!selected.length){setError('Select at least one page for this part.');return}
    setGroups(old=>[...old,[...selected]])
    setSelected([]);setError('')
  }

  function movePage(from,to){
    if(from===null||from===to)return
    setThumbnails(old=>{
      const copy=[...old]
      const [v]=copy.splice(from,1)
      copy.splice(to,0,v)
      return copy
    })
    setSelected(old=>old.map(i=>i===from?to:i===to?from:i))
  }

  async function runTool(){
    setError('')
    if(!files.length){setError('Choose your file(s) first.');return}
    if(active==='merge'&&files.length<2){setError('Add at least two PDFs to merge.');return}
    if(active==='compress'&&!confirm('Compression converts pages to JPEG images and removes selectable text. Continue?'))return
    if(active==='split'&&options.splitMode==='groups'&&!groups.length&&!selected.length){
      setError('Select pages and add them as a part, or choose one PDF per page.')
      return
    }

    setBusy(true);setView('processing')
    try{
      let output=[]
      const opts={
        ...options,
        pages:active==='reorder'?thumbnails.map(p=>p.pageNumber).join(','):options.pages,
        selectedPages:selected,
        splitGroups:groups.length?[...groups,...(selected.length?[[...selected]]:[])]:selected.length?[[...selected]]:[]
      }

      if(active==='toimages'){
        output=(await renderPdfPages(files[0])).map(x=>({...x,type:'image/png'}))
      }else{
        const data=await processPdf(active,files,opts)
        if(active==='split'){
          output=[{name:`${safeName(files[0].name)}-parts.zip`,blob:data,type:'application/zip'}]
        }else{
          output=[{
            name:active==='merge'?'merged-document.pdf':`${safeName(files[0].name)}-${active}.pdf`,
            blob:data instanceof Blob?data:new Blob([data],{type:'application/pdf'}),
            type:'application/pdf'
          }]
        }
      }

      setResults(output.map(x=>({...x,size:x.blob.size})))
      setView('results')
    }catch(e){
      setError(e?.message||'Something went wrong while processing this file.')
      setView('error')
    }finally{
      setBusy(false)
    }
  }

  const selector=files.length>0&&active!=='images'&&['split','extract','rotate','reorder'].includes(active)

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={home}>
        <span className="brand-mark"><FileText size={21}/><span/></span>
        <span>priv<span className="brand-accent">pdf</span><small>PRIVATE BY DESIGN</small></span>
      </button>

      <nav className={menuOpen?'nav nav-open':'nav'}>
        <a href="#tools" onClick={()=>setMenuOpen(false)}>All tools</a>
        <a href="#privacy" onClick={()=>setMenuOpen(false)}>Privacy</a>
        <a href="#about" onClick={()=>setMenuOpen(false)}>About</a>
      </nav>

      <div className="header-right">
        <div className="theme-switcher" role="group" aria-label="Color theme">
  {[
    {value:'system',label:'System',Icon:Menu},
    {value:'light',label:'Light',Icon:Sparkles},
    {value:'dark',label:'Dark',Icon:LockKeyhole}
  ].map(({value,label,Icon})=>(
    <button
      key={value}
      type="button"
      className={`theme-option ${themePreference===value?'is-active':''}`}
      aria-pressed={themePreference===value}
      onClick={()=>{
        setThemePreference(value)
        try{localStorage.setItem('privpdf-theme',value)}catch{}
      }}
    >
      <Icon size={15}/>
      <span>{label}</span>
    </button>
  ))}
</div>
        <span className="local-pill"><span className="live-dot"/> Local processing</span>
        <button className="mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={20}/></button>
      </div>
    </header>

    {!active?<main>
      <section className="hero">
        <div className="hero-glow"/>
        <div className="hero-copy">
          <div className="eyebrow"><ShieldCheck size={14}/> YOUR FILES NEVER LEAVE YOUR DEVICE</div>
          <h1>Your PDFs.<br/><span>Your rules.</span></h1>
          <p className="hero-lede">A beautifully simple PDF workspace built around one idea: your documents are yours. Process files right in your browser — no uploads, no accounts, no waiting.</p>
          <div className="hero-actions">
            <a className="primary-btn" href="#tools">Explore PDF tools <ArrowRight size={17}/></a>
            <a className="text-link" href="#privacy"><LockKeyhole size={15}/> How privacy works</a>
          </div>
          <div className="trust-row">
            <div className="trust-item"><ShieldCheck size={17}/><span><b>100% local</b><small>Files stay in your browser</small></span></div>
            <div className="trust-item"><LockKeyhole size={17}/><span><b>No account</b><small>No sign-up required</small></span></div>
            <div className="trust-item"><Sparkles size={17}/><span><b>Free to use</b><small>No artificial limits added</small></span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-orbit orbit-one"/>
          <div className="visual-orbit orbit-two"/>
          <div className="document-card back-card">
            <div className="doc-top"><span className="doc-tag">PDF</span><span>02</span></div>
            <div className="fake-lines"><i/><i/><i/><i/></div>
            <div className="doc-chart"><span/><span/><span/><span/><span/></div>
          </div>
          <div className="document-card front-card">
            <div className="doc-top"><span className="doc-tag">PDF</span><span>01</span></div>
            <div className="doc-title-line"/>
            <div className="fake-lines"><i/><i/><i/><i/><i/></div>
            <div className="doc-highlight"><ShieldCheck size={18}/><span>Private by default</span></div>
          </div>
          <div className="floating-lock"><LockKeyhole size={23}/></div>
          <div className="float-chip chip-top"><CheckCircle2 size={15}/> On-device processing</div>
          <div className="float-chip chip-bottom"><span className="mini-pulse"/> No uploads. Ever.</div>
        </div>
      </section>

      <section className="privacy-strip" id="privacy">
        <div className="privacy-icon"><ShieldCheck size={23}/></div>
        <div><b>Privacy isn't a feature. It's the architecture.</b><p>Your files are read into browser memory and processed on your device. There is no PDF upload endpoint in this app.</p></div>
        <a href="#about">Read our approach <ChevronRight size={15}/></a>
      </section>

      <section className="tools-section" id="tools">
        <div className="section-heading">
          <div><div className="eyebrow">THE TOOLKIT</div><h2>Everything you need.<br/><span>Nothing you don't.</span></h2></div>
          <p>Choose a tool, add your file, and get straight to work.</p>
        </div>
        {['Organize','Edit','Optimize','Convert'].map(group=><div className="tool-group" key={group}>
          <div className="group-label">{group}<span/></div>
          <div className="tool-grid">{TOOLS.filter(t=>t.group===group).map(t=><ToolCard key={t.id} tool={t} onClick={()=>chooseTool(t.id)}/>)}</div>
        </div>)}
      </section>

      <section className="bottom-cta">
        <div className="cta-icon"><LockKeyhole size={22}/></div>
        <div><h3>Your documents deserve privacy.</h3><p>Start working with your PDFs — no account, no uploads, no fuss.</p></div>
        <a href="#tools" className="secondary-btn">Choose a tool <ArrowRight size={16}/></a>
      </section>
    </main>:<main className="workspace-main">
      <div className="breadcrumbs"><button onClick={home}>All tools</button><ChevronRight size={14}/><span>{view==='results'?'Results':view==='processing'?'Processing':activeTool?.name}</span></div>

      {view==='results'?<section className="results-panel">
        <div className="result-success"><CheckCircle2 size={25}/><div><h1>Your files are ready</h1><p>Processed locally on your device. Nothing was uploaded.</p></div></div>
        <div className="result-list">{results.map((r,i)=><div className="result-row" key={r.name+i}>
          <div className="file-icon"><FileText size={19}/></div>
          <div className="file-meta"><b>{r.name}</b><small>{formatBytes(r.size)} · {r.type==='application/zip'?'ZIP archive':r.type==='image/png'?'PNG image':'PDF document'}</small></div>
          <button className="download-result" onClick={()=>downloadBlob(r.blob,r.name)}><Download size={16}/> Download</button>
        </div>)}</div>
        <div className="result-actions">
          <button className="secondary-btn" onClick={()=>{setFiles([]);setResults([]);setView('upload');setGroups([]);setThumbnails([]);setSelected([])}}><Plus size={16}/> Try another file</button>
          <button className="text-link" onClick={home}>Back to all tools <ArrowRight size={15}/></button>
        </div>
      </section>:view==='processing'?<section className="processing-panel">
        <LoaderCircle className="spin" size={32}/><h1>Working on your PDF…</h1><p>Processing locally in your browser. Large files may take a little while.</p>
      </section>:view==='error'?<section className="results-panel">
        <div className="status error-status"><AlertTriangle size={18}/>{error}</div><h2>We couldn't finish this task</h2><p className="muted-copy">Your original file is unchanged. Review the error, adjust your settings, and try again.</p>
        <div className="result-actions"><button className="secondary-btn" onClick={()=>setView('upload')}>Back to settings</button><button className="text-link" onClick={home}>Back to all tools</button></div>
      </section>:<>
        <div className="workspace-heading">
          <div className="tool-large-icon"><activeTool.icon size={27}/></div>
          <div><div className="eyebrow">{activeTool.group.toUpperCase()} TOOL</div><h1>{activeTool.name}</h1><p>{activeTool.desc}. Everything runs locally in your browser.</p></div>
        </div>

        <div className="workspace-grid">
          <section className="work-panel">
            <div className="panel-head"><div><span className="step-number">01</span><b>Add your files</b></div><span className="private-label"><LockKeyhole size={13}/> Private session</span></div>

            <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current?.click()}>
              <input ref={inputRef} type="file" accept={activeTool.accepts} multiple={!!activeTool.multi} hidden onChange={e=>{addFiles(e.target.files);e.target.value=''}}/>
              <div className="upload-icon"><Upload size={23}/></div><b>Drop your {active==='images'?'images':'PDF'} here</b><p>or <span>browse files</span> on your device</p><small>{active==='images'?'JPG and PNG files':'PDF files'} · processed locally</small>
            </div>

            {files.length>0&&<div className="file-list">
              <div className="file-list-heading">{files.length} file{files.length!==1?'s':''} selected <span>{formatBytes(totalBytes)}</span></div>
              {files.map((f,i)=><div className="file-row" key={f.name+i}>
                <div className="file-icon"><FileText size={17}/></div><div className="file-meta"><b>{f.name}</b><small>{formatBytes(f.size)}</small></div>
                <button className="icon-button" onClick={()=>setFiles(old=>old.filter((_,j)=>j!==i))} aria-label="Remove file"><X size={16}/></button>
              </div>)}
            </div>}

            {selector&&<section className="page-selector">
              <div className="selector-heading"><div><h3><Eye size={16}/> Select pages</h3><p>{active==='reorder'?'Drag thumbnails to change the order.':'Tap thumbnails to select or deselect pages.'}</p></div><span>{selected.length} selected</span></div>
              {thumbBusy?<div className="thumb-loading"><LoaderCircle className="spin"/> Creating page previews…</div>:<div className="thumbnail-grid">
                {thumbnails.map((p,i)=><button key={`${p.pageNumber}-${i}`} className={`page-thumb ${selected.includes(i)?'page-selected':''}`} onClick={()=>togglePage(i)} draggable={active==='reorder'} onDragStart={()=>setDragIndex(i)} onDragOver={e=>e.preventDefault()} onDrop={()=>{movePage(dragIndex,i);setDragIndex(null)}} title={`Page ${p.pageNumber}`}>
                  <span className="thumb-check">{selected.includes(i)?<CheckCircle2 size={17}/>:<span/>}</span><img src={p.dataUrl} alt={`Page ${p.pageNumber}`}/><small>Page {p.pageNumber}</small>
                </button>)}
              </div>}
              <div className="selector-actions"><button className="small-action" onClick={()=>setSelected(thumbnails.map((_,i)=>i))}>Select all</button><button className="small-action" onClick={()=>setSelected([])}>Clear selection</button></div>

              {active==='split'&&<div className="options-box">
                <label>Split method</label><div className="choice-row">
                  <button className={options.splitMode==='groups'?'choice active-choice':'choice'} onClick={()=>setOptions(o=>({...o,splitMode:'groups'}))}>Custom groups</button>
                  <button className={options.splitMode==='pages'?'choice active-choice':'choice'} onClick={()=>setOptions(o=>({...o,splitMode:'pages'}))}>One PDF per page</button>
                </div>
                {options.splitMode==='groups'?<><small>Select pages for a part, then add it. Repeat to create more parts.</small>
                  <button className="small-action full-action" onClick={addGroup}><Plus size={14}/> Add selected pages as part</button>
                  {groups.map((g,i)=><div className="split-group" key={i}><span><b>Part {i+1}</b><small>Pages {g.map(n=>n+1).join(', ')}</small></span><button className="icon-button" onClick={()=>setGroups(old=>old.filter((_,j)=>j!==i))}><Trash2 size={15}/></button></div>)}
                </>:<small>Every page becomes a separate PDF in one ZIP archive.</small>}
              </div>}

              {active==='extract'&&<div className="options-box"><label htmlFor="pages">Page numbers (optional)</label><input id="pages" value={options.pages} onChange={e=>setOptions(o=>({...o,pages:e.target.value}))}/><small>Selected thumbnails take priority. Clear selection to use this range.</small></div>}
              {active==='rotate'&&<div className="options-box"><label>Rotation angle</label><div className="choice-row">{['90','180','270'].map(v=><button key={v} className={options.rotation===v?'choice active-choice':'choice'} onClick={()=>setOptions(o=>({...o,rotation:v}))}>{v}°</button>)}</div></div>}
              {active==='reorder'&&<div className="hint-box">Drag page thumbnails to change their order. Include all pages in the final sequence.</div>}
            </section>}

            {active==='watermark'&&<div className="options-box"><label>Watermark text</label><input value={options.watermark} maxLength={120} onChange={e=>setOptions(o=>({...o,watermark:e.target.value}))}/></div>}
            {active==='numbers'&&<div className="options-box"><label>Number prefix</label><input value={options.prefix} maxLength={24} onChange={e=>setOptions(o=>({...o,prefix:e.target.value}))} placeholder="e.g. Page "/></div>}
                        {active==='compress'&&<div className="options-box">
              <label>Compression information</label>
              <small>
                This tool converts PDF pages to JPEG images to reduce file size.
                Selectable text, accessibility features, and some vector sharpness
                will be lost.
              </small>
            </div>}

            {active==='toimages'&&<div className="hint-box">
              Each PDF page will be exported as a PNG image. Large documents may
              take longer to process and use more memory.
            </div>}

            {error&&<div className="status error-status">
              <AlertTriangle size={17}/>
              <span>{error}</span>
              <button className="icon-button" onClick={()=>setError('')} aria-label="Dismiss error">
                <X size={15}/>
              </button>
            </div>}

            <div className="workspace-actions">
              <button
                className="primary-btn process-btn"
                onClick={runTool}
                disabled={busy||!files.length}
              >
                {busy
                  ? <><LoaderCircle className="spin" size={17}/> Processing…</>
                  : <><Sparkles size={17}/> Process {activeTool.name}</>}
              </button>
              <button className="text-link" onClick={home}>
                Cancel
              </button>
            </div>
          </section>

          <aside className="side-panel">
            <div className="side-card">
              <div className="side-card-icon"><ShieldCheck size={20}/></div>
              <h3>Your privacy matters</h3>
              <p>Files are processed locally in your browser. They are not uploaded to a PDF processing server.</p>
              <div className="side-check"><CheckCircle2 size={15}/> On-device processing</div>
              <div className="side-check"><CheckCircle2 size={15}/> No account required</div>
              <div className="side-check"><CheckCircle2 size={15}/> Original files remain unchanged</div>
            </div>

            <div className="side-card side-help">
              <h3>How it works</h3>
              <ol>
                <li>Add your PDF or images.</li>
                <li>Choose the pages or settings you need.</li>
                <li>Process your files and download the result.</li>
              </ol>
            </div>
          </aside>
        </div>
      </>}
    </main>}

    <footer className="site-footer" id="about">
      <a href="#tools" className="footer-brand">priv<span>pdf</span></a>
      <p>Private by design. Processed in your browser.</p>
      <a href="#privacy">Our privacy approach</a>
      <small>© {new Date().getFullYear()} PrivPDF</small>
    </footer>
  </div>
}function ToolCard({tool,onClick}){
  const Icon=tool.icon

  return (
    <button className="tool-card" onClick={onClick}>
      <span className="tool-card-icon">
        <Icon size={21}/>
      </span>
      <span className="tool-card-copy">
        <b>{tool.name}</b>
        <small>{tool.desc}</small>
      </span>
      <ArrowRight className="tool-card-arrow" size={17}/>
    </button>
  )
}