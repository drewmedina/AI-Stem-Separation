import { useState, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import stemAppLogo from './assets/stemAppLogo.svg'
import stemLogoBackground from './assets/stemLogoBackground.svg'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import WaveSurfer from '@wavesurfer/react'
import JSZip from 'jszip'
// @ts-ignore: If you see a type error for file-saver, run: npm i --save-dev @types/file-saver
import { saveAs } from 'file-saver'

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [stems, setStems] = useState<{ vocals: string; instruments: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const backendUrl = "http://127.0.0.1:5000"
  const vocalsWaveSurferRef = useRef<any>(null)
  const instrumentsWaveSurferRef = useRef<any>(null)
  const [isVocalsPlaying, setIsVocalsPlaying] = useState(false)
  const [isInstrumentsPlaying, setIsInstrumentsPlaying] = useState(false)

  // Reset WaveSurfer instances when stems change
  useEffect(() => {
    if (stems) {
      // Small delay to ensure DOM elements are ready
      setTimeout(() => {
        if (vocalsWaveSurferRef.current) {
          vocalsWaveSurferRef.current.destroy()
        }
        if (instrumentsWaveSurferRef.current) {
          instrumentsWaveSurferRef.current.destroy()
        }
      }, 100)
    }
  }, [stems])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.ogg']
    },
    onDrop: async (acceptedFiles: File[]) => {
      setFiles(acceptedFiles)
      setFilename(acceptedFiles[0]?.name || null)
      setLoading(true)
      setError(null)
      setStems(null)
      try {
        const formData = new FormData()
        formData.append('file', acceptedFiles[0])
        const response = await fetch('http://127.0.0.1:5000/api/separate', {
          method: 'POST',
          body: formData
        })
        if (!response.ok) throw new Error('Failed to separate stems')
        const data = await response.json()
        setStems({ vocals: data.vocals, instruments: data.instruments })
      } catch (err: any) {
        setError(err.message || 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
  })

  // Download ZIP of both stems
  const handleDownloadZip = async () => {
    if (!stems) return
    const zip = new JSZip()
    const fetchAndAdd = async (url: string, name: string) => {
      const res = await fetch(backendUrl + url)
      const blob = await res.blob()
      zip.file(name, blob)
    }
    await fetchAndAdd(stems.vocals, 'vocals.wav')
    await fetchAndAdd(stems.instruments, 'instruments.wav')
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, (filename ? filename.replace(/\.[^/.]+$/, "") : 'stems') + '.zip')
  }

  // Reset UI
  const handleReset = () => {
    setFiles([])
    setStems(null)
    setFilename(null)
    setError(null)
  }

  // Play/pause handlers
  const handleVocalsPlayPause = () => {
    if (vocalsWaveSurferRef.current) {
      if (vocalsWaveSurferRef.current.isPlaying()) {
        vocalsWaveSurferRef.current.pause()
        setIsVocalsPlaying(false)
      } else {
        vocalsWaveSurferRef.current.play()
        setIsVocalsPlaying(true)
      }
    }
  }
  const handleInstrumentsPlayPause = () => {
    if (instrumentsWaveSurferRef.current) {
      if (instrumentsWaveSurferRef.current.isPlaying()) {
        instrumentsWaveSurferRef.current.pause()
        setIsInstrumentsPlaying(false)
      } else {
        instrumentsWaveSurferRef.current.play()
        setIsInstrumentsPlaying(true)
      }
    }
  }

  // Sync play state with WaveSurfer events
  useEffect(() => {
    if (vocalsWaveSurferRef.current) {
      vocalsWaveSurferRef.current.on('finish', () => setIsVocalsPlaying(false))
      vocalsWaveSurferRef.current.on('pause', () => setIsVocalsPlaying(false))
      vocalsWaveSurferRef.current.on('play', () => setIsVocalsPlaying(true))
    }
    if (instrumentsWaveSurferRef.current) {
      instrumentsWaveSurferRef.current.on('finish', () => setIsInstrumentsPlaying(false))
      instrumentsWaveSurferRef.current.on('pause', () => setIsInstrumentsPlaying(false))
      instrumentsWaveSurferRef.current.on('play', () => setIsInstrumentsPlaying(true))
    }
  }, [stems])

  return (
    <div className="min-h-screen w-full bg-[#0E0E13] relative flex flex-col overflow-hidden">
      {/* Decorative logo on top of the gradient */}
      <img
        src={stemLogoBackground}
        alt="Decorative Logo"
        className="pointer-events-none select-none fixed left-1/2 z-0"
        style={{
          width: '1100px',
          height: '1100px',
          transform: 'translateX(-50%)',
          bottom: '-430.5px',
          opacity: 0.6,
          filter: 'blur(2.5px) drop-shadow(0 8px 32px rgba(0,0,0,0.25))',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable="false"
      />
      {/* Header */}
      <header className="relative z-10 w-full flex justify-between items-center px-10 py-6">
        <div className="flex items-center space-x-2">
          <img src={stemAppLogo} alt="Stem Logo" className="h-7 w-7" />
          <span className="text-white text-xl font-medium tracking-tight">Stem</span>
        </div>
        <button className="bg-white text-black font-semibold px-6 py-2 rounded-full shadow-none hover:bg-gray-200 transition-all text-sm">
          JOIN WAITLIST
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 sm:px-8">
        {!stems ? (
          <>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white mb-8 sm:mb-12 text-center drop-shadow-lg">
              What can I help you split?
            </h1>
            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`w-full max-w-xl bg-[#19191e] border border-[#35353c] rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center cursor-pointer transition-colors duration-200
                ${isDragActive ? 'border-white/60 bg-[#23232a]' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center space-y-4">
                {/* Music icon */}
                <svg className="h-12 w-12 text-[#9B9B9B]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-2v13" />
                  <circle cx="6" cy="18" r="3" fill="currentColor" />
                  <circle cx="18" cy="16" r="3" fill="currentColor" />
                </svg>
                <span className="text-[#9B9B9B] text-base text-center">
                  Click to select a MP3 or WAV file to upload or drag and drop here
                </span>
              </div>
            </div>
            {loading && <div className="mt-8 text-gray-300">Separating stems, please wait...</div>}
            {error && <div className="mt-8 text-red-400">{error}</div>}
          </>
        ) : (
          <>
          <div className="w-full max-w-2xl bg-[#19191e] border border-[#35353c] rounded-2xl p-8 flex flex-col items-center relative shadow-lg">
            {/* Filename and Download ZIP */}
            <div className="w-full flex justify-between items-center mb-6">
              <span className="text-lg font-semibold text-[#8B8B8B] truncate max-w-[60%]">{filename}</span>
              <button
                className="bg-transparent border border-white text-white px-6 py-2 rounded-full font-semibold hover:bg-white hover:text-black transition-colors"
                onClick={handleDownloadZip}
              >
                DOWNLOAD .ZIP
              </button>
            </div>
            {/* Stems */}
            <div className="w-full flex flex-col gap-6">
              {/* Vocals Row */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between w-full">
                  <span className="text-white font-semibold text-base">VOCALS</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-full hover:bg-[#23232a] transition-colors text-white"
                      aria-label="Play/Pause vocals"
                      onClick={handleVocalsPlayPause}
                    >
                      {isVocalsPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 5.25v13.5m10.5-13.5v13.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25l13.5 6.75-13.5 6.75V5.25z" />
                        </svg>
                      )}
                    </button>
                    <a
                      href={`${backendUrl}${stems.vocals}`}
                      download
                      className="p-2 rounded-full hover:bg-[#23232a] transition-colors"
                      aria-label="Download vocals"
                    >
                      <ArrowDownTrayIcon className="h-6 w-6 text-white" />
                    </a>
                  </div>
                </div>
                <div className="w-full h-16">
                  <WaveSurfer
                    onReady={(wavesurfer) => {
                      vocalsWaveSurferRef.current = wavesurfer
                    }}
                    height={64}
                    waveColor="#8B8B8B"
                    progressColor="#fff"
                    url={`${backendUrl}${stems.vocals}`}
                    barWidth={2}
                    barGap={2}
                    barRadius={2}
                    normalize={true}
                    autoplay={false}
                  />
                </div>
              </div>
              <hr className="border-[#35353c] my-2" />
              {/* Instruments Row */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between w-full">
                  <span className="text-white font-semibold text-base">INSTRUMENTS</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-full hover:bg-[#23232a] transition-colors text-white"
                      aria-label="Play/Pause instruments"
                      onClick={handleInstrumentsPlayPause}
                    >
                      {isInstrumentsPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 5.25v13.5m10.5-13.5v13.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25l13.5 6.75-13.5 6.75V5.25z" />
                        </svg>
                      )}
                    </button>
                    <a
                      href={`${backendUrl}${stems.instruments}`}
                      download
                      className="p-2 rounded-full hover:bg-[#23232a] transition-colors"
                      aria-label="Download instruments"
                    >
                      <ArrowDownTrayIcon className="h-6 w-6 text-white" />
                    </a>
                  </div>
                </div>
                <div className="w-full h-16">
                  <WaveSurfer
                    onReady={(wavesurfer) => {
                      instrumentsWaveSurferRef.current = wavesurfer
                    }}
                    height={64}
                    waveColor="#8B8B8B"
                    progressColor="#fff"
                    url={`${backendUrl}${stems.instruments}`}
                    barWidth={2}
                    barGap={2}
                    barRadius={2}
                    normalize={true}
                    autoplay={false}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Try another track button below results */}
          <div className="w-full flex justify-center mt-8">
            <button
              className="text-white text-base underline hover:text-gray-300 transition-colors"
              onClick={handleReset}
            >
              Try another track?
            </button>
          </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
