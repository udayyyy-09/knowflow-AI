import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

// Configure PDF.js worker for Vite
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfCanvasViewerProps {
  blob: Blob;
}

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
}

const PdfPage: React.FC<PdfPageProps> = ({ pdfDoc, pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Scale to 1.3 for crisp HiDPI viewing
        const viewport = page.getViewport({ scale: 1.3 });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        } as any);

        await renderTask.promise;
        if (!isCancelled) {
          setRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber]);

  return (
    <div className="relative bg-white shadow-md rounded-md border border-[#DDD9CC] overflow-hidden flex flex-col items-center">
      {!rendered && (
        <div className="w-full h-96 flex items-center justify-center bg-[#F6F5F0]/50">
          <Spinner size="md" />
        </div>
      )}
      <canvas ref={canvasRef} className={`block ${rendered ? '' : 'hidden'}`} />
      <div className="w-full text-center py-1.5 text-[11px] font-mono text-[#8C93A0] bg-[#FAFAF7] border-t border-[#EEEBE2]">
        Page {pageNumber} of {pdfDoc.numPages}
      </div>
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ blob }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load PDF:', err);
        if (!isCancelled) {
          setError(err?.message || 'Failed to parse PDF document.');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (pdfDoc) {
        try {
          pdfDoc.cleanup();
        } catch {
          // ignore
        }
      }
    };
  }, [blob]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#F6F5F0]">
        <Spinner size="lg" />
        <p className="text-xs text-[#5B6270] font-medium">Rendering PDF document...</p>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#F6F5F0]">
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2 max-w-md">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || 'Unable to display PDF document.'}</span>
        </div>
      </div>
    );
  }

  const pages = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#EAE8E0]/70 flex flex-col items-center space-y-6">
      {pages.map((pageNum) => (
        <PdfPage key={pageNum} pdfDoc={pdfDoc} pageNumber={pageNum} />
      ))}
    </div>
  );
};
