
import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Trash2, 
  CheckCircle2, 
  Download, 
  Zap, 
  Loader2, 
  AlertCircle,
  FileText,
  MousePointer2,
  ScanSearch,
  Pipette,
  History,
  Sparkles,
  Image as ImageIcon,
  Package,
  Layers,
  Settings2,
  Maximize2
} from 'lucide-react';
import { AppStatus, WatermarkDetectionResult } from './types';
import { 
  getPdfThumbnail, 
  getBottomRightCrop, 
  removeWatermarkFromPdf, 
  convertPdfToImagesZip 
} from './services/pdfService';
import { detectWatermark } from './services/geminiService';

const EXPORT_SCALES = [
  { label: '标准 (1x)', value: 1.0, desc: '文件小, 速度快' },
  { label: '高清 (2x)', value: 2.0, desc: '适合移动端查看' },
  { label: '超清 (3x)', value: 3.0, desc: '极致细节还原' },
  { label: '极致 (4x)', value: 4.0, desc: '打印级清晰度' }
];

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<{ dataUrl: string; width: number; height: number; aspectRatio: number } | null>(null);
  const [detection, setDetection] = useState<WatermarkDetectionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processedPdf, setProcessedPdf] = useState<Uint8Array | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [selectedScale, setSelectedScale] = useState(2.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      setError("请选择有效的 PDF 文件。");
      return;
    }
    reset();
    setFile(selectedFile);
    setStatus(AppStatus.UPLOADING);
    
    try {
      const thumb = await getPdfThumbnail(selectedFile);
      setThumbnail(thumb);
      setStatus(AppStatus.ANALYZING);
      
      const { base64 } = await getBottomRightCrop(selectedFile);
      const result = await detectWatermark(base64);
      
      if (result.width <= 0 || result.height <= 0) {
        throw new Error("AI 未能在右下角检测到明显的水印或标识。");
      }

      // Add a small default padding (2 units) to the detected area for better coverage
      setDetection({
        ...result,
        x: Math.max(0, result.x - 1),
        y: Math.max(0, result.y - 1),
        width: Math.min(100, result.width + 2),
        height: Math.min(100, result.height + 2)
      });
      setStatus(AppStatus.READY_TO_PROCESS);
    } catch (err: any) {
      setError(err.message || "分析过程中出现错误。");
      setStatus(AppStatus.IDLE);
    }
  };

  const startProcessing = async () => {
    if (!file || !detection) return;
    setStatus(AppStatus.PROCESSING);
    setProgress(0);
    
    try {
      const result = await removeWatermarkFromPdf(file, detection, (p) => setProgress(p));
      setProcessedPdf(result);
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "PDF 处理失败。");
      setStatus(AppStatus.READY_TO_PROCESS);
    }
  };

  const downloadResult = () => {
    if (!processedPdf || !file) return;
    const blob = new Blob([processedPdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaned_${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConvertToZip = async () => {
    if (!processedPdf || !file) return;
    setIsZipping(true);
    setZipProgress(0);
    try {
      const zipBlob = await convertPdfToImagesZip(processedPdf, (p) => setZipProgress(p), selectedScale);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.pdf', '')}_${selectedScale}x_Images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("导出图片包失败。");
    } finally {
      setIsZipping(false);
    }
  };

  const reset = () => {
    setFile(null);
    setThumbnail(null);
    setDetection(null);
    setProcessedPdf(null);
    setProgress(0);
    setError(null);
    setStatus(AppStatus.IDLE);
    setIsZipping(false);
    setZipProgress(0);
  };

  const handleDetectionChange = (key: keyof WatermarkDetectionResult, value: number | string) => {
    if (detection) {
      setDetection({ ...detection, [key]: value });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              PDF 智能助手
            </h1>
          </div>
          {status !== AppStatus.IDLE && (
            <button 
              onClick={reset}
              className="text-slate-400 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-50 active:scale-95"
              title="重置"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {status === AppStatus.IDLE && (
          <div className="flex flex-col items-center py-12">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-xl aspect-[16/10] bg-white border-2 border-dashed border-slate-300 rounded-[3rem] flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-all group shadow-xl shadow-slate-200/40"
            >
              <div className="bg-indigo-100 p-8 rounded-[2rem] group-hover:scale-110 group-hover:bg-indigo-200 transition-all duration-500 group-hover:rotate-3 shadow-inner">
                <FileUp className="w-16 h-16 text-indigo-600" />
              </div>
              <div className="text-center px-8">
                <p className="text-3xl font-black text-slate-800 tracking-tight">上传 PDF 课件</p>
                <p className="text-slate-500 mt-3 text-lg font-medium">去水印 • 智能吸色 • 高清导出</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf"
              />
            </div>
          </div>
        )}

        {status !== AppStatus.IDLE && (
          <div className="grid lg:grid-cols-12 gap-10 items-start animate-in fade-in zoom-in-95 duration-500">
            {/* Left: Preview Panel */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black flex items-center gap-3 text-slate-800">
                  <FileText className="w-6 h-6 text-indigo-500" />
                  可视化预览与定位
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
                    {thumbnail ? `${Math.round(thumbnail.width)}x${Math.round(thumbnail.height)}` : '计算中'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-center bg-slate-200/30 rounded-[2.5rem] p-6 border-2 border-slate-100 shadow-inner min-h-[400px]">
                {thumbnail ? (
                  <div 
                    className="relative bg-white shadow-2xl rounded-lg overflow-hidden ring-1 ring-slate-900/5 transition-all duration-500"
                    style={{ 
                      aspectRatio: thumbnail.aspectRatio,
                      width: '100%',
                      maxWidth: `calc(75vh * ${thumbnail.aspectRatio})`
                    }}
                  >
                    <img src={thumbnail.dataUrl} className="w-full h-full object-contain pointer-events-none" alt="PDF Preview" />
                    
                    {detection && (
                      <div 
                        className="absolute border-[2px] border-dashed border-indigo-500 bg-indigo-500/10 z-10 transition-all duration-75 shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                        style={{
                          left: `${60 + (detection.x * 0.4)}%`,
                          top: `${60 + (detection.y * 0.4)}%`,
                          width: `${detection.width * 0.4}%`,
                          height: `${detection.height * 0.4}%`,
                        }}
                      >
                        <div className="absolute -top-7 left-0 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg font-black whitespace-nowrap flex items-center gap-1.5">
                          覆盖区
                        </div>
                      </div>
                    )}
                    
                    {/* Visual Indicators for the 40% Crop area helper */}
                    <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-indigo-500/5 border-l border-t border-indigo-500/10 pointer-events-none" />

                    {(status === AppStatus.PROCESSING || isZipping) && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[4px] z-20 flex items-center justify-center transition-all duration-500">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-5 border border-slate-100">
                          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                          <div className="text-center">
                            <p className="text-xl font-black text-slate-800">{isZipping ? '导出高清图片...' : '正在处理 PDF...'}</p>
                            <p className="text-xs text-slate-400 mt-1 font-bold">{isZipping ? `${zipProgress}%` : `${progress}%`}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-300" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium px-4 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" />
                提示：预览框比例已自适应 PDF。淡色虚线区域为水印检测热区（右下角 40%）。
              </p>
            </div>

            {/* Right: Controls Panel */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/60 space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">区域微调</h2>
                  <p className="text-slate-400 font-medium text-sm">精确控制水印覆盖坐标</p>
                </div>

                {detection && (
                  <div className="space-y-5 py-4 border-y border-slate-50">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                          <span>水平位置 (X)</span>
                          <span className="text-indigo-600 font-mono">{detection.x}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" step="0.1"
                          value={detection.x}
                          onChange={(e) => handleDetectionChange('x', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                          <span>垂直位置 (Y)</span>
                          <span className="text-indigo-600 font-mono">{detection.y}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" step="0.1"
                          value={detection.y}
                          onChange={(e) => handleDetectionChange('y', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">宽度</label>
                          <input 
                            type="number" value={detection.width}
                            onChange={(e) => handleDetectionChange('width', parseFloat(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">高度</label>
                          <input 
                            type="number" value={detection.height}
                            onChange={(e) => handleDetectionChange('height', parseFloat(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-xl shadow-md ring-2 ring-white flex-shrink-0" 
                        style={{ backgroundColor: detection.backgroundColor }}
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">背景采样色</p>
                        <p className="text-sm font-black text-slate-700 font-mono truncate">{detection.backgroundColor.toUpperCase()}</p>
                      </div>
                      <Pipette className="w-5 h-5 text-indigo-400" />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">导出采样率</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPORT_SCALES.map((scale) => (
                      <button
                        key={scale.value}
                        onClick={() => setSelectedScale(scale.value)}
                        className={`py-3 rounded-2xl border-2 transition-all text-xs font-black ${
                          selectedScale === scale.value 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {scale.label}
                      </button>
                    ))}
                  </div>
                </div>

                {status === AppStatus.READY_TO_PROCESS && (
                  <button 
                    onClick={startProcessing}
                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-3xl shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-4 group"
                  >
                    <Zap className="w-6 h-6 text-indigo-400" />
                    <span className="text-lg">执行 处理 PDF</span>
                  </button>
                )}

                {status === AppStatus.COMPLETED && (
                  <div className="space-y-4">
                    <button 
                      onClick={downloadResult}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-lg transition-all flex items-center justify-center gap-4 active:scale-95"
                    >
                      <Download className="w-5 h-5" />
                      <span className="text-md">保存 PDF 结果</span>
                    </button>
                    
                    <button 
                      onClick={handleConvertToZip}
                      disabled={isZipping}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-3xl shadow-lg transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
                    >
                      {isZipping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                      <span className="text-md">导出高清图片包</span>
                    </button>

                    <button 
                      onClick={reset}
                      className="w-full bg-white border-2 border-slate-100 text-slate-400 font-black py-4 rounded-3xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      <History className="w-4 h-4" />
                      重新处理
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-100 bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-slate-300 text-sm font-black tracking-widest uppercase">
            Precision PDF Engine • Gemini 2.5 Vision
          </p>
        </div>
      </footer>
      
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          margin-top: -6px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 6px;
          cursor: pointer;
          background: #f1f5f9;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
