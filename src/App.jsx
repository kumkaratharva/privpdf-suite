import React, { useMemo, useRef, useState } from 'react'
import {
  ShieldCheck, LockKeyhole, Files, Scissors, Minimize2, RotateCw, Stamp,
  Images, FileImage, ArrowUpDown, Layers3, Hash, Upload, Download, X,
  ChevronRight, CheckCircle2, Menu, Github, Sparkles, ArrowRight, FileText,
  LoaderCircle, Trash2, Plus, Eye, AlertTriangle
} from 'lucide-react'
import { processPdf, renderPdfPages, savePdf, downloadBlob, safeName } from './pdfTools.js'

const TOOLS = [
  { id:'merge', name:'Merge PDF', desc:'Combine documents in seconds', icon:Files, group:'Organize', accepts:'.pdf', multi:true },
  { id:'split', name:'Split PDF', desc:'Save a selected page range', icon:Scissors, group:'Organize', accepts:'.pdf' },
  { id:'extract', name:'Extract pages', desc:'Create a PDF from chosen pages', icon:Layers3, group:'Organize', accepts:'.pdf' },
  { id:'reorder', name:'Reorder pages', desc:'Rearrange the page sequence', icon:ArrowUpDown, group:'Organize', accepts:'.pdf' },
  { id:'rotate', name:'Rotate PDF', desc:'Rotate every page at once', icon:RotateCw, group:'Edit', accepts:'.pdf' },
  { id:'watermark', name:'Watermark PDF', desc:'Add a subtle text watermark', icon:Stamp, group:'Edit', accepts:'.pdf' },
  { id:'numbers', name:'Add page numbers', desc:'Number pages automatically', icon:Hash, group:'Edit', accepts:'.pdf' },
  { id:'compress', name:'Compress PDF', desc:'Create a smaller, image-based PDF', icon:Minimize2, group:'Optimize', accepts:'.pdf' },
  { id:'images', name:'Images to PDF', desc:'Turn JPG and PNG files into a PDF', icon:Images, group:'Convert', accepts:'.jpg,.jpeg,.png', multi:true },
  { id:'toimages', name:'PDF to images', desc:'Export pages as PNG images', icon:FileImage, group:'Convert', accepts:'.pdf' },
]
const formatBytes = n => n < 1024 ? `${n} B` : n < 1024**2 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024**2).toFixed(2)} MB`

export default function App() {
  const [active, setActive] = useState(null)
  const [files, setFiles] = useState([])
  const [options, setOptions] = useState({ pages:'1-3', rotation:'90', watermark:'CONFIDENTIAL', prefix:'' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef(null)
  const activeTool = TOOLS.find(t => t.id === active)
  const totalBytes = useMemo(() => files.reduce((n,f)=>n+f.size,0), [files])

  function chooseTool(id) {
    setActive(id); setFiles([]); setError(''); setSuccess('')
    setOptions({ pages:'1-3', rotation:'90', watermark:'CONFIDENTIAL', prefix:'' })
    setMenuOpen(false)
    window.history.replaceState({}, '', `#${id}`)
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  function addFiles(incoming) {
    const picked = Array.from(incoming || [])
    if (!picked.length) return
    const tool = TOOLS.find(t=>t.id===active)
    const accepted = tool?.id === 'images'
      ? picked.filter(f => /image\/(png|jpeg)/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name))
      : picked.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (accepted.length !== picked.length) setError(tool?.id === 'images' ? 'Only PNG and JPG images are supported.' : 'Choose PDF files only.')
    setFiles(old => tool?.multi ? [...old, ...accepted] : accepted.slice(0,1))
    setSuccess('')
  }
  async function runTool() {
    setError(''); setSuccess('')
    if (!activeTool || !files.length) { setError('Choose your file(s) first.'); return }
    if (active === 'merge' && files.length < 2) { setError('Add at least two PDFs to merge.'); return }
    if (active === 'compress' && !window.confirm('Compression converts every page into a JPEG image. Searchable text, accessibility, and vector sharpness will be lost. Continue?')) return
    setBusy(true)
    try {
      if (active === 'toimages') {
        const pages = await renderPdfPages(files[0])
        for (const p of pages) downloadBlob(p.blob, p.name)
        setSuccess(`Exported ${pages.length} PNG page${pages.length === 1 ? '' : 's'}. Your files stayed on this device.`)
      } else {
        const bytes = await processPdf(active, files, options)
        const base = active === 'merge' ? 'merged-document' : `${safeName(files[0].name)}-${active}`
        savePdf(bytes, base)
        setSuccess(`Done — your PDF was created locally and downloaded. No file upload was made.`)
      }
    } catch (e) {
      setError(e?.message || 'Something went wrong while processing this file.')
    } finally { setBusy(false) }
  }
  function drop(e) { e.preventDefault(); addFiles(e.dataTransfer.files) }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>{setActive(null);setFiles([]);window.history.replaceState({},'',' ')}} aria-label="PrivPDF home">
        <span className="brand-mark"><FileText size={21}/><span/></span>
        <span>priv<span className="brand-accent">pdf</span><small>PRIVATE BY DESIGN</small></span>
      </button>
      <nav className={menuOpen?'nav nav-open':'nav'}>
        <a href="#tools" onClick={()=>setMenuOpen(false)}>All tools</a>
        <a href="#privacy" onClick={()=>setMenuOpen(false)}>Privacy</a>
        <a href="#about" onClick={()=>setMenuOpen(false)}>About</a>
      </nav>
      <div className="header-right"><span className="local-pill"><span className="live-dot"/> Local processing</span><button className="mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={20}/></button></div>
    </header>

    {!active ? <main>
      <section className="hero">
        <div className="hero-glow"/>
        <div className="hero-copy">
          <div className="eyebrow"><ShieldCheck size={14}/> YOUR FILES NEVER LEAVE YOUR DEVICE</div>
          <h1>Your PDFs.<br/><span>Your rules.</span></h1>
          <p className="hero-lede">A beautifully simple PDF workspace built around one idea: your documents are yours. Process files right in your browser — no uploads, no accounts, no waiting.</p>
          <div className="hero-actions"><a className="primary-btn" href="#tools">Explore PDF tools <ArrowRight size={17}/></a><a className="text-link" href="#privacy"><LockKeyhole size={15}/> How privacy works</a></div>
          <div className="trust-row"><div className="trust-item"><ShieldCheck size={17}/><span><b>100% local</b><small>Files stay in your browser</small></span></div><div className="trust-item"><LockKeyhole size={17}/><span><b>No account</b><small>No sign-up required</small></span></div><div className="trust-item"><Sparkles size={17}/><span><b>Free to use</b><small>No artificial limits added</small></span></div></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
          <div className="document-card back-card"><div className="doc-top"><span className="doc-tag">PDF</span><span>02</span></div><div className="fake-lines"><i/><i/><i/><i/></div><div className="doc-chart"><span/><span/><span/><span/><span/></div></div>
          <div className="document-card front-card"><div className="doc-top"><span className="doc-tag">PDF</span><span>01</span></div><div className="doc-title-line"/><div className="fake-lines"><i/><i/><i/><i/><i/></div><div className="doc-highlight"><ShieldCheck size={18}/><span>Private by default</span></div></div>
          <div className="floating-lock"><LockKeyhole size={23}/></div><div className="float-chip chip-top"><CheckCircle2 size={15}/> On-device processing</div><div className="float-chip chip-bottom"><span className="mini-pulse"/> No uploads. Ever.</div>
        </div>
      </section>

      <section className="privacy-strip" id="privacy"><div className="privacy-icon"><ShieldCheck size={23}/></div><div><b>Privacy isn't a feature. It's the architecture.</b><p>Your files are read into browser memory and processed on your device. There is no PDF upload endpoint in this app.</p></div><a href="#about">Read our approach <ChevronRight size={15}/></a></section>

      <section className="tools-section" id="tools">
        <div className="section-heading"><div><div className="eyebrow">THE TOOLKIT</div><h2>Everything you need.<br/><span>Nothing you don't.</span></h2></div><p>Choose a tool, add your file, and get straight to work. Simple, secure, and right where you need it.</p></div>
        {['Organize','Edit','Optimize','Convert'].map(group=><div className="tool-group" key={group}><div className="group-label">{group}<span/></div><div className="tool-grid">{TOOLS.filter(t=>t.group===group).map(tool=><ToolCard key={tool.id} tool={tool} onClick={()=>chooseTool(tool.id)}/>)}</div></div>)}
      </section>
      <section className="bottom-cta"><div className="cta-icon"><LockKeyhole size={22}/></div><div><h3>Your documents deserve privacy.</h3><p>Start working with your PDFs — no account, no uploads, no fuss.</p></div><a href="#tools" className="secondary-btn">Choose a tool <ArrowRight size={16}/></a></section>
    </main> : <main className="workspace-main">
      <div className="breadcrumbs"><button onClick={()=>{setActive(null);setFiles([]);window.history.replaceState({},'','#tools')}}>All tools</button><ChevronRight size={14}/><span>{activeTool?.name}</span></div>
      <div className="workspace-heading"><div className="tool-large-icon"><activeTool.icon size={27}/></div><div><div className="eyebrow">{activeTool.group.toUpperCase()} TOOL</div><h1>{activeTool.name}</h1><p>{activeTool.desc}. Everything runs locally in your browser.</p></div></div>
      <div className="workspace-grid">
        <section className="work-panel">
          <div className="panel-head"><div><span className="step-number">01</span><b>Add your files</b></div><span className="private-label"><LockKeyhole size={13}/> Private session</span></div>
          <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={drop} onClick={()=>inputRef.current?.click()}>
            <input ref={inputRef} type="file" accept={activeTool.accepts} multiple={!!activeTool.multi} onChange={e=>{addFiles(e.target.files);e.target.value=''}} hidden/>
            <div className="upload-icon"><Upload size={23}/></div><b>Drop your {active==='images'?'images':'PDF'} here</b><p>or <span>browse files</span> on your device</p><small>{active==='images'?'JPG and PNG files':'PDF files'} · processed locally</small>
          </div>
          {files.length>0 && <div className="file-list"><div className="file-list-heading">{files.length} file{files.length!==1?'s':''} selected <span>{formatBytes(totalBytes)}</span></div>{files.map((f,i)=><div className="file-row" key={`${f.name}-${i}`}><div className="file-icon"><FileText size={17}/></div><div className="file-meta"><b>{f.name}</b><small>{formatBytes(f.size)}</small></div><button className="icon-button" onClick={e=>{e.stopPropagation();setFiles(old=>old.filter((_,j)=>j!==i))}} aria-label={`Remove ${f.name}`}><X size={16}/></button></div>)}</div>}
          {['split','extract','reorder'].includes(active) && <div className="options-box"><label htmlFor="pages">{active==='reorder'?'New page order':'Pages to include'}</label><input id="pages" value={options.pages} onChange={e=>setOptions(o=>({...o,pages:e.target.value}))} placeholder={active==='reorder'?'3,1,2,4':'1-3, 5'}/><small>{active==='reorder'?'Enter every page once in the desired order, e.g. 3,1,2,4.':'Use page numbers and ranges separated by commas, e.g. 1-3, 5, 8-10.'}</small></div>}
          {active==='rotate' && <div className="options-box"><label>Rotation angle</label><div className="choice-row">{['90','180','270'].map(v=><button key={v} className={options.rotation===v?'choice active-choice':'choice'} onClick={()=>setOptions(o=>({...o,rotation:v}))}>{v}°</button>)}</div></div>}
          {active==='watermark' && <div className="options-box"><label htmlFor="watermark">Watermark text</label><input id="watermark" maxLength={120} value={options.watermark} onChange={e=>setOptions(o=>({...o,watermark:e.target.value}))}/><small>Applied diagonally across every page.</small></div>}
          {active==='numbers' && <div className="options-box"><label htmlFor="prefix">Number prefix (optional)</label><input id="prefix" maxLength={24} value={options.prefix} onChange={e=>setOptions(o=>({...o,prefix:e.target.value}))} placeholder="e.g. Page "/></div>}
          {active==='compress' && <div className="warning-box"><AlertTriangle size={17}/><p><b>Image-based compression</b><br/>This experimental mode converts pages to JPEG images. Text will no longer be selectable/searchable. Keep your original file.</p></div>}
          <button className="process-btn" disabled={busy||!files.length} onClick={runTool}>{busy?<><LoaderCircle className="spin" size={18}/> Processing on your device…</>:<><Sparkles size={17}/> {active==='toimages'?'Export PNG images':active==='images'?'Create PDF':'Process PDF'} <ArrowRight size={17}/></>}</button>
          {error&&<div className="status error-status"><AlertTriangle size={16}/>{error}</div>}
          {success&&<div className="status success-status"><CheckCircle2 size={16}/>{success}</div>}
          <div className="panel-foot"><LockKeyhole size={14}/> Your files are processed locally and are not uploaded.</div>
        </section>
        <aside className="side-panel"><div className="side-card"><div className="side-card-icon"><ShieldCheck size={21}/></div><h3>Private by design</h3><p>Your selected files stay in this browser tab. Processing uses local JavaScript and WebAssembly-capable libraries — no server-side file handling.</p><div className="side-divider"/><div className="assurance"><CheckCircle2 size={15}/> No file upload</div><div className="assurance"><CheckCircle2 size={15}/> No account required</div><div className="assurance"><CheckCircle2 size={15}/> You control the download</div></div><div className="side-card tips-card"><h4><Sparkles size={16}/> Quick tip</h4><p>{active==='merge'?'Add files in the order you want them to appear in the final PDF.':active==='compress'?'Keep a copy of your original. Image-based compression may reduce quality and removes searchable text.':active==='images'?'For best results, use JPG or PNG images. Each image becomes one PDF page.':active==='toimages'?'Each PDF page will download as a separate PNG image. Large documents may take a little time.':active==='reorder'?'Use a comma-separated list of all page numbers in your preferred sequence.':'Check your page range and settings before processing. The original file is not changed.'}</p></div></aside>
      </div>
    </main>}

    <footer id="about"><div className="footer-brand"><span className="brand-mark"><FileText size={17}/><span/></span><b>priv<span className="brand-accent">pdf</span></b></div><p>Made for your documents. Built for your privacy.</p><div className="footer-right"><span><span className="live-dot"/> Browser-only processing</span><span>© {new Date().getFullYear()} PrivPDF</span></div></footer>
  </div>
}

function ToolCard({tool,onClick}) {
  const Icon=tool.icon
  return <button className="tool-card" onClick={onClick}><div className="tool-card-top"><span className="tool-icon"><Icon size={20}/></span><span className="card-arrow"><ArrowRight size={16}/></span></div><b>{tool.name}</b><p>{tool.desc}</p></button>
}
