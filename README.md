# PrivPDF — Privacy-first PDF workspace

A static React + Vite PDF toolkit. PDF files are selected locally and processed in the browser with `pdf-lib` and `pdfjs-dist`; this app has no file-upload backend.

## Included tools

- Merge PDFs (preserves chosen file order)
- Split PDF / extract selected pages
- Reorder pages
- Rotate all pages
- Text watermark
- Add page numbers
- Images to PDF (JPG/PNG)
- PDF to PNG images
- Experimental image-based compression (explicitly warns that text/vector content is rasterized)

## Requirements

- Node.js 20+
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. In GitHub, open **Settings → Pages** and choose **GitHub Actions** as the build/deployment source.
3. If the site is hosted at `https://USERNAME.github.io/REPOSITORY/`, edit `.github/workflows/deploy.yml` and add `env: VITE_BASE_PATH: /REPOSITORY/` to the `Build` step (or set the equivalent environment variable for the build job). For a `USERNAME.github.io` root repository, the default `/` base is correct.
4. Commit and push. The workflow builds `dist` and publishes it to Pages.

GitHub Pages project-site base-path example:

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_BASE_PATH: /your-repository-name/
```

## Privacy model

- Files are read using the browser File API and handled in memory.
- The app does not send document bytes to a server or use an upload endpoint.
- Output files are created as browser Blob URLs and downloaded by the user.
- No analytics or tracking scripts are included in the app.
- A Google Fonts import is included for visual styling. For a stricter no-third-party-network-requests policy, remove the `@import` from `src/styles.css` and use system fonts or bundle font files locally.
- Browser extensions, compromised devices, browser crash reports, and the hosting provider's normal static-site request logs are outside this app's control. Avoid promising absolute privacy.

## Technical notes / limitations

- `pdf-lib` handles common page operations, copying, drawing text, rotation, and image embedding. It does not provide full PDF editing or robust structural compression.
- The current **Compress PDF** implementation renders every page to JPEG and rebuilds the PDF. It can reduce size for some documents but loses selectable/searchable text, accessibility structure, vector quality, links, and other document semantics. This is clearly warned before use. For production, consider offering it as “Rasterize & reduce size” and add a separate lossless optimization strategy if available.
- PDF-to-images downloads one PNG per page. Browser download policies may prompt users or limit multiple downloads for large documents.
- Password-protected PDFs and malformed PDFs may fail to load.
- Very large files can consume substantial browser memory. A future desktop wrapper could handle heavier tasks.
- “Split” currently creates one output PDF from the entered page ranges; for multiple separate output files, implement range-group export.
- GitHub Pages is static hosting; tool routes are represented as hash routes (`#merge`, etc.) to avoid deep-link 404s. Dedicated SEO landing pages can be added as separate static HTML entry points if organic search is a priority.

## Suggested next steps

1. Add page thumbnails and drag-and-drop ordering for merge/reorder.
2. Add accessible progress reporting and cancellation for long jobs.
3. Add tests with sample PDFs and a browser-based smoke test.
4. Self-host fonts, add a CSP/security headers plan where hosting allows, and audit dependencies.
5. Add dedicated SEO pages per tool with unique titles, descriptions, canonical URLs, FAQs, and internal links.
