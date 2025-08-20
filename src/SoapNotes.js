// src/SoapNotes.js
import React, { useState, useRef, useEffect } from 'react';
import './SoapNotes.css';

const SoapNotes = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [soapNotes, setSoapNotes] = useState('');
  const [status, setStatus] = useState('');
  const [recordings, setRecordings] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (isRecording || isProcessing || cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 1000); // prevent double-clicks

    try {
      const ws = new WebSocket('ws://weal-customer-chatbot-stage.up.railway.app/transcription/ws');
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (event.data.startsWith('RECORDING_SAVED:')) {
          const filename = event.data.replace('RECORDING_SAVED:', '');
          addRecordingToList(filename);
          setStatus(`Recording saved: ${filename}`);
          setIsProcessing(false);
        } else if (event.data.startsWith('LIVE_TRANSCRIPT:')) {
          const text = event.data.replace('LIVE_TRANSCRIPT:', '');
          setLiveTranscript(prev => prev + text + '\n');
        } else if (event.data.startsWith('OPENAI_TRANSCRIPT:')) {
          const text = event.data.replace('OPENAI_TRANSCRIPT:', '');
          setFinalTranscript(text);
        } else if (event.data.startsWith('SOAP_NOTES:')) {
          const notes = event.data.replace('SOAP_NOTES:', '');
          setSoapNotes(notes);
        }
      };

      ws.onopen = async () => {
        setIsRecording(true);
        setLiveTranscript('');
        setFinalTranscript('');
        setSoapNotes('');
        setStatus('Recording...');
        setIsProcessing(false);

        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true
            }
          });
          mediaStreamRef.current = mediaStream;

          const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
          });
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(mediaStream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(audioContext.destination);

          processor.onaudioprocess = (e) => {
            const floatSamples = e.inputBuffer.getChannelData(0);
            const int16Buffer = new Int16Array(floatSamples.length);

            for (let i = 0; i < floatSamples.length; i++) {
              let s = Math.max(-1, Math.min(1, floatSamples[i]));
              int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(int16Buffer.buffer);
            }
          };

        } catch (err) {
          console.error('Microphone access error:', err);
          setStatus('Error: Could not access microphone');
          setIsRecording(false);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatus('WebSocket connection error');
        setIsRecording(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setStatus('Connection closed');
        setIsRecording(false);
      };

    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('Error starting recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setStatus('Processing with OpenAI...');
    setIsProcessing(true);

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('stop');
      wsRef.current = null;
    }

    setIsRecording(false);
  };

  const addRecordingToList = (filename) => {
    const newRecording = {
      filename,
      timestamp: new Date().toLocaleString(),
      id: Date.now()
    };
    setRecordings(prev => [newRecording, ...prev]);
  };

  const downloadRecording = (filename) => {
    const link = document.createElement('a');
    link.href = `http://weal-customer-chatbot-stage.up.railway.app/transcription/recordings/${filename}`;
    link.download = filename;
    link.click();
  };

  return (
    <div className="soap-notes-container">
      <div className="soap-header">
        <h1>🎙️ SOAP Notes Transcription</h1>
        <p>Record audio to generate SOAP notes automatically</p>
      </div>

      <div className="recording-controls">
        <button
          className={`record-button ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
        </button>

        {status && (
          <div className={`status ${isProcessing ? 'processing' : ''}`}>
            {isProcessing && <div className="spinner"></div>}
            {status}
          </div>
        )}
      </div>

      <div className="content-grid">
        <div className="transcript-section">
          <h3>🔴 Live Transcript (AssemblyAI)</h3>
          <div className="transcript-box live">
            {liveTranscript || 'Live transcription will appear here...'}
          </div>
        </div>

        <div className="transcript-section">
          <h3>📝 Final Transcript (OpenAI Whisper)</h3>
          <div className="transcript-box final">
            {isProcessing && !finalTranscript ? (
              <div className="loading-content">
                <div className="spinner"></div>
                <p>Processing transcript...</p>
              </div>
            ) : (
              finalTranscript || 'Final transcript will appear here...'
            )}
          </div>
        </div>

        <div className="soap-section">
          <h3>🏥 SOAP Notes</h3>
          <div className="soap-box">
            {isProcessing && !soapNotes ? (
              <div className="loading-content">
                <div className="spinner"></div>
                <p>Generating SOAP notes...</p>
              </div>
            ) : (
              <pre>{soapNotes || 'SOAP notes will be generated here...'}</pre>
            )}
          </div>
        </div>
      </div>

      {recordings.length > 0 && (
        <div className="recordings-section">
          <h3>📂 Saved Recordings</h3>
          <div className="recordings-list">
            {recordings.map((recording) => (
              <div key={recording.id} className="recording-item">
                <div className="recording-info">
                  <strong>{recording.filename}</strong>
                  <span className="timestamp">{recording.timestamp}</span>
                </div>
                <div className="recording-actions">
                  <button
                    className="download-btn"
                    onClick={() => downloadRecording(recording.filename)}
                  >
                    📥 Download
                  </button>
                  <audio controls>
                    <source
                      src={`http://weal-customer-chatbot-stage.up.railway.app/transcription/recordings/${recording.filename}`}
                      type="audio/wav"
                   
                      
                    />
                    Your browser does not support audio playback.
                  </audio>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SoapNotes;
