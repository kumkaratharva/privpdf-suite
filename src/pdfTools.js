import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export const readBytes = async (file) => new Uint8Array(await file.arrayBuffer())
export const savePdf = (bytes, filename) => {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  downloadBlob(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
export const safeName = (s) => (s || 'document').replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '-')

export async function mergePdfs(files) {
  if (files.length < 2) throw new Error('Choose at least two PDF files to merge.')
  const out = await PDFDocument.create()
  for (const file of files) {
    const src = await PDFDocument.load(await readBytes(file))
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach(p => out.addPage(p))
  }
  return out.save()
}

function parseRanges(input, max) {
  const result = new Set()
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (!parts.length) throw new Error('Enter page numbers, for example 1-3, 5.')
  for (const part of parts) {
    const match = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (match) {
      let a = Number(match[1]), b = Number(match[2])
      if (a > b) [a, b] = [b, a]
      if (a < 1 || b > max) throw new Error(`Page range must be between 1 and ${max}.`)
      for (let n = a; n <= b; n++) result.add(n - 1)
    } else if (/^\d+$/.test(part)) {
      const n = Number(part)
      if (n < 1 || n > max) throw new Error(`Page number must be between 1 and ${max}.`)
      result.add(n - 1)
    } else throw new Error(`Could not read "${part}". Use a format like 1-3, 5.`)
  }
  return [...result].sort((a, b) => a - b)
}
export { parseRanges }

export async function processPdf(tool, files, options = {}) {
  const file = files[0]
  if (!file && tool !== 'merge') throw new Error('Choose a PDF file first.')
  if (tool === 'merge') return mergePdfs(files)

  if (tool === 'images') {
    if (!files.length) throw new Error('Choose one or more images.')
    const out = await PDFDocument.create()
    for (const f of files) {
      const bytes = await readBytes(f)
      let image
      if (f.type === 'image/png' || /\.png$/i.test(f.name)) image = await out.embedPng(bytes)
      else if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) image = await out.embedJpg(bytes)
      else throw new Error(`${f.name}: choose PNG or JPG images.`)
      const page = out.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    }
    return out.save()
  }

  const src = await PDFDocument.load(await readBytes(file), { ignoreEncryption: false })
  const count = src.getPageCount()
  const out = await PDFDocument.create()

  if (tool === 'split' || tool === 'extract') {
    const indices = parseRanges(options.pages || '1', count)
    const copied = await out.copyPages(src, indices)
    copied.forEach(p => out.addPage(p))
    return out.save()
  }
  if (tool === 'rotate') {
    const amount = Number(options.rotation || 90)
    src.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + amount) % 360)))
    return src.save()
  }
  if (tool === 'watermark') {
    const font = await src.embedFont(StandardFonts.HelveticaBold)
    const label = (options.watermark || 'CONFIDENTIAL').slice(0, 120)
    for (const page of src.getPages()) {
      const { width, height } = page.getSize()
      const size = Math.max(18, Math.min(52, width / Math.max(label.length * 0.55, 1)))
      page.drawText(label, {
        x: width * 0.12, y: height * 0.48, size, font,
        color: rgb(0.45, 0.48, 0.55), opacity: 0.32,
        rotate: degrees(-32), maxWidth: width * 0.78,
      })
    }
    return src.save()
  }
  if (tool === 'numbers') {
    const font = await src.embedFont(StandardFonts.Helvetica)
    src.getPages().forEach((page, i) => {
      const { width } = page.getSize()
      page.drawText(`${options.prefix || ''}${i + 1}`, {
        x: width / 2 - 8, y: 20, size: 10, font, color: rgb(0.25, 0.28, 0.34)
      })
    })
    return src.save()
  }
  if (tool === 'reorder') {
    const order = parseRanges(options.pages || Array.from({length: count}, (_,i)=>i+1).join(','), count)
    if (order.length !== count) throw new Error(`Include every page exactly once. This PDF has ${count} pages.`)
    if (new Set(order).size !== count) throw new Error('Each page must appear only once.')
    const copied = await out.copyPages(src, order)
    copied.forEach(p => out.addPage(p))
    return out.save()
  }
  if (tool === 'compress') {
    // True structural/object-stream compression is limited in pdf-lib. This option
    // rasterizes pages to JPEG and can reduce size, but sacrifices selectable text,
    // vector quality and accessibility. Keep it explicitly opt-in in the UI.
    const loading = pdfjsLib.getDocument({ data: await readBytes(file) })
    const pdf = await loading.promise
    const raster = await PDFDocument.create()
    const scale = Number(options.quality || 1.25)
    const quality = Number(options.jpegQuality || 0.62)
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d', { alpha: false })
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) throw new Error('Could not render a page for compression.')
      const jpg = await raster.embedJpg(await blob.arrayBuffer())
      const p = raster.addPage([jpg.width / scale, jpg.height / scale])
      p.drawImage(jpg, { x: 0, y: 0, width: jpg.width / scale, height: jpg.height / scale })
      canvas.width = 0; canvas.height = 0
    }
    await pdf.destroy()
    return raster.save({ useObjectStreams: true })
  }
  throw new Error('This tool is not implemented.')
}

export async function renderPdfPages(file, scale = 1.25) {
  const task = pdfjsLib.getDocument({ data: await readBytes(file) })
  const pdf = await task.promise
  const results = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    results.push({ blob, name: `${safeName(file.name)}-page-${i}.png` })
    canvas.width = 0; canvas.height = 0
  }
  await pdf.destroy()
  return results
}
