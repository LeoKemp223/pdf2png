
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';

// Declare pdfjsLib globally since it's loaded in index.html
declare const pdfjsLib: any;

/**
 * Generates a full thumbnail for the first page.
 */
export async function getPdfThumbnail(file: File): Promise<{ dataUrl: string; width: number; height: number; aspectRatio: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    width: viewport.width,
    height: viewport.height,
    aspectRatio: viewport.width / viewport.height
  };
}

/**
 * Gets a high-res crop of the bottom-right 40% of the first page for Gemini analysis.
 */
export async function getBottomRightCrop(file: File): Promise<{ base64: string; width: number; height: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  const cropW = viewport.width * 0.4;
  const cropH = viewport.height * 0.4;
  canvas.width = cropW;
  canvas.height = cropH;

  // Move context to bottom right
  context.translate(- (viewport.width - cropW), - (viewport.height - cropH));
  await page.render({ canvasContext: context, viewport }).promise;
  
  return {
    base64: canvas.toDataURL('image/jpeg', 0.95).split(',')[1],
    width: cropW,
    height: cropH
  };
}

/**
 * Samples the background color from a specific PDF page.
 */
async function sampleColorFromPage(
  pdf: any,
  pageNum: number,
  xPercent: number, // 0-100 of full page
  yPercent: number  // 0-100 of full page (from top)
): Promise<{ r: number, g: number, b: number }> {
  const page = await pdf.getPage(pageNum);
  const scale = 1.0;
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 1;
  canvas.height = 1;

  const sampleX = (xPercent / 100) * viewport.width;
  const sampleY = (yPercent / 100) * viewport.height;

  context.translate(-sampleX, -sampleY);
  await page.render({ canvasContext: context, viewport }).promise;

  const pixel = context.getImageData(0, 0, 1, 1).data;
  return {
    r: pixel[0] / 255,
    g: pixel[1] / 255,
    b: pixel[2] / 255
  };
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 1, g: 1, b: 1 };
}

/**
 * Removes watermark from PDF with intelligent per-page color detection.
 */
export async function removeWatermarkFromPdf(
  file: File, 
  detection: { x: number; y: number; width: number; height: number; backgroundColor: string },
  onProgress: (p: number) => void
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // Map detection coordinates (relative to 40% crop) to full page percentages
    const relativeXInPage = 60 + (detection.x * 0.4);
    const relativeYInPage = 60 + (detection.y * 0.4);

    let pageColor;
    try {
      // Sample slightly to the left of the patch to get background color
      pageColor = await sampleColorFromPage(
        pdfJsDoc, 
        i + 1, 
        Math.max(0, relativeXInPage - 1), 
        relativeYInPage + (detection.height * 0.2)
      );
    } catch (e) {
      pageColor = hexToRgb(detection.backgroundColor);
    }

    const patchWidth = (detection.width / 100) * (width * 0.4);
    const patchHeight = (detection.height / 100) * (height * 0.4);
    
    const patchX = (width * 0.6) + (detection.x / 100) * (width * 0.4);
    
    // PDF coordinates: (0,0) is bottom-left. 
    // Detection coordinates (from top of crop): 0 is 40% height, 100 is 0% height.
    const cropTopInPdf = height * 0.4;
    const patchY = cropTopInPdf - (detection.y / 100) * (height * 0.4) - patchHeight;

    page.drawRectangle({
      x: patchX,
      y: patchY,
      width: patchWidth,
      height: patchHeight,
      color: rgb(pageColor.r, pageColor.g, pageColor.b),
      borderWidth: 0,
    });
    
    onProgress(Math.round(((i + 1) / pages.length) * 100));
  }

  return await pdfDoc.save();
}

/**
 * Converts PDF pages into images and bundles them into a ZIP file.
 */
export async function convertPdfToImagesZip(
  pdfBytes: Uint8Array,
  onProgress: (p: number) => void,
  scale: number = 2.0
): Promise<Blob> {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const numPages = pdf.numPages;
  const zip = new JSZip();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    const imageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    zip.file(`slide_${i.toString().padStart(3, '0')}.png`, imageBlob);
    onProgress(Math.round((i / numPages) * 100));
  }

  return await zip.generateAsync({ type: 'blob' });
}
