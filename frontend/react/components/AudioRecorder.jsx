import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { audioError, formatTime, MAX_RECORD_SECONDS } from '../lib/mediaFiles';

const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export default function AudioRecorder({ audio, onChange, onRecordingChange, resetKey }) {
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const stream = useRef(null);
  const interval = useRef(null);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const fileInput = useRef(null);
  const player = useRef(null);
  const busy = phase !== 'idle';

  function releaseCapture() {
    clearInterval(interval.current);
    interval.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
      releaseCapture();
    };
  }, []);

  useEffect(() => {
    requestId.current += 1;
    releaseCapture();
    setPhase('idle');
    setElapsed(0);
    setError('');
  }, [resetKey]);

  useEffect(() => { onRecordingChange(busy); }, [busy, onRecordingChange]);

  function stopRecording() {
    if (recorder.current?.state !== 'recording') return;
    setPhase('finishing');
    clearInterval(interval.current);
    interval.current = null;
    recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }

  async function startRecording() {
    if (busy) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is unavailable in this browser. You can upload an audio file instead.');
      return;
    }

    const currentRequest = ++requestId.current;
    setPhase('requesting');
    player.current?.pause();

    try {
      const acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || currentRequest !== requestId.current) {
        acquiredStream.getTracks().forEach(track => track.stop());
        return;
      }

      stream.current = acquiredStream;
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(acquiredStream, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks = [];
      let failed = false;
      const startedAt = performance.now();

      recording.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recording.onerror = () => {
        failed = true;
        acquiredStream.getTracks().forEach(track => track.stop());
        if (!mounted.current || currentRequest !== requestId.current) return;
        clearInterval(interval.current);
        interval.current = null;
        if (mounted.current && currentRequest === requestId.current) {
          setError('The recording stopped unexpectedly. Try again or upload an audio file.');
          setPhase('idle');
        }
      };

      recording.onstop = () => {
        acquiredStream.getTracks().forEach(track => track.stop());
        if (!mounted.current || currentRequest !== requestId.current) return;
        clearInterval(interval.current);
        interval.current = null;
        recorder.current = null;
        stream.current = null;

        if (!failed) {
          const type = recording.mimeType || chunks[0]?.type || 'application/octet-stream';
          const blob = new Blob(chunks, { type });
          const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg'
            : type.includes('webm') ? 'webm' : 'audio';
          const file = new File([blob], 'meal-description.' + extension, { type });
          const validationError = audioError(file);
          if (validationError) setError(validationError);
          else onChange(file, { source: 'recording', duration: (performance.now() - startedAt) / 1000 });
        }
        setPhase('idle');
      };

      recording.start();
      setElapsed(0);
      setPhase('recording');
      interval.current = setInterval(() => {
        const seconds = Math.floor((performance.now() - startedAt) / 1000);
        setElapsed(Math.min(seconds, MAX_RECORD_SECONDS));
        if (seconds >= MAX_RECORD_SECONDS) stopRecording();
      }, 250);
    } catch (captureError) {
      if (!mounted.current || currentRequest !== requestId.current) return;
      releaseCapture();
      const messages = {
        NotAllowedError: 'Microphone access was denied. Allow it in your browser or upload an audio file.',
        NotFoundError: 'No microphone was found. Connect one or upload an audio file.',
        NotReadableError: 'Your microphone is unavailable. Check whether another app is using it.',
      };
      setError(messages[captureError.name] || 'We could not start the microphone. Try again or upload an audio file.');
      setPhase('idle');
    }
  }

  function uploadAudio(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const validationError = audioError(file);
    setError(validationError);
    if (!validationError) onChange(file, { source: 'upload' });
  }

  const recording = phase === 'recording';
  const title = recording ? 'Recording your meal…'
    : phase === 'requesting' ? 'Waiting for microphone access…'
    : phase === 'finishing' ? 'Preparing your recording…'
    : audio ? 'Voice description added' : 'Describe your meal';

  return (
    <section className="voice-meal" aria-labelledby="voice-heading">
      <div className="voice-heading-row">
        <h3 id="voice-heading">Voice meal description</h3>
        <span>Optional</span>
      </div>
      <p className="meal-section-description">Tell your pal about ingredients, portions, or how it was cooked.</p>
      <div className={'voice-recorder' + (recording ? ' is-recording' : '')}>
        <button className="voice-record-button" type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={phase === 'requesting' || phase === 'finishing'}
          aria-label={recording ? 'Stop recording' : audio ? 'Record a new voice description' : 'Record a voice description'}>
          <AppIcon name={recording ? 'stop' : 'mic'} size={25} />
        </button>
        <div className="voice-recorder-copy">
          <p className="voice-recorder-title" role="status">{title}</p>
          <span>{busy ? formatTime(elapsed) + ' / ' + formatTime(MAX_RECORD_SECONDS)
            : audio ? audio.name : 'Tap the mic to record up to one minute.'}</span>
        </div>
        <div className="voice-waveform" aria-hidden="true">
          {[10, 20, 30, 18, 36, 24, 14].map((height, index) => (
            <span key={index} style={{ height: height + 'px', animationDelay: (index * 0.12) + 's' }} />
          ))}
        </div>
      </div>

      {audio && !busy && <div className="voice-audio-preview">
        <audio ref={player} controls preload="metadata" src={audio.url} aria-label="Your meal voice description" />
        <button className="voice-remove" type="button" onClick={() => { setError(''); onChange(null); }}>
          <AppIcon name="close" size={16} /> Remove audio
        </button>
      </div>}

      <div className="voice-upload-row">
        <input ref={fileInput} className="visually-hidden" id="meal-audio" type="file"
          aria-label="Meal audio" accept="audio/*,.m4a,.webm" onChange={uploadAudio} disabled={busy} />
        <button className="voice-upload-button" type="button" disabled={busy} onClick={() => fileInput.current.click()}>
          <AppIcon name="folder" size={18} /> Upload audio
        </button>
        <span>Audio files up to 10 MB</span>
      </div>
      {error && <p className="media-error" role="alert">{error}</p>}
    </section>
  );
}
