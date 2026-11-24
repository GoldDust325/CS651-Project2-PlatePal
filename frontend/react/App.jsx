import { useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MealPicker from './components/MealPicker';
import CompanionSelector from './components/CompanionSelector';
import AudioRecorder from './components/AudioRecorder';
import MealResults from './components/MealResults';
import MealHistory from './components/MealHistory';
import AppIcon from './components/AppIcon';
import { photoError } from './lib/mediaFiles';
import { analyzeMeal } from './lib/mealAnalysis';
import { useAuth } from './AuthProvider';
import '../css/app.css';

export default function App() {
  const { user, loading: sessionLoading } = useAuth();
  const [mealImage, setMealImage] = useState(null);
  const [mealAudio, setMealAudio] = useState(null);
  const [companion, setCompanion] = useState('Casual');
  const [analysis, setAnalysis] = useState(null);
  const [imageError, setImageError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPhotoBusy, setIsPhotoBusy] = useState(false);
  const [photoResetKey, setPhotoResetKey] = useState(0);
  const [audioResetKey, setAudioResetKey] = useState(0);
  const activeRequest = useRef(null);
  const previousUser = useRef(user?.uid);

  useEffect(() => () => { if (mealImage) URL.revokeObjectURL(mealImage.url); }, [mealImage]);
  useEffect(() => () => { if (mealAudio) URL.revokeObjectURL(mealAudio.url); }, [mealAudio]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    if (sessionLoading) return;
    if (previousUser.current && previousUser.current !== user?.uid) resetMeal();
    previousUser.current = user?.uid;
  }, [user?.uid, sessionLoading]);

  function clearAnalysis() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setAnalysis(null);
    setAnalysisError('');
  }

  function selectPhoto(file, details = {}) {
    const validationError = photoError(file);
    setImageError(validationError);
    if (validationError) return;
    clearAnalysis();
    setMealImage({ file, url: URL.createObjectURL(file), name: file.name, googlePhotoId: details.googlePhotoId });
  }

  function removePhoto() {
    clearAnalysis();
    setMealImage(null);
    setImageError('');
  }

  function selectAudio(file, details = {}) {
    clearAnalysis();
    setMealAudio(file ? { file, url: URL.createObjectURL(file), name: file.name, ...details } : null);
  }

  function changeCompanion(value) {
    if (value === companion) return;
    clearAnalysis();
    setCompanion(value);
  }

  function resetMeal() {
    clearAnalysis();
    setMealImage(null);
    setMealAudio(null);
    setImageError('');
    setPhotoResetKey(value => value + 1);
    setAudioResetKey(value => value + 1);
  }

  async function submitMeal() {
   if (!mealImage || isRecording || isPhotoBusy || loading) return;
    const request = new AbortController();
    activeRequest.current = request;
    setLoading(true);
    setAnalysisError('');
    try {
      const result = await analyzeMeal({
        photo: mealImage?.file,
        photoSource: mealImage?.googlePhotoId ? 'google_photos' : 'local',
        audio: mealAudio?.file,
        audioDuration: mealAudio?.duration,
        companion,
        signal: request.signal,
      });
      if (activeRequest.current === request) setAnalysis(result);
    } catch (error) {
      if (activeRequest.current === request && error.name !== 'AbortError') {
        setAnalysisError(error.message || 'We could not analyze this meal. Please try again.');
      }
    } finally {
      if (activeRequest.current === request) {
        setLoading(false);
        activeRequest.current = null;
      }
    }
  }

  return (
    <>
      <Navbar currentPage="App" />
      <main id="main-content" className="page-content container meal-workspace">
        <header className="workspace-intro mb-4">
          <div className="workspace-intro-copy">
            <p className="eyebrow">Your companion at the table</p>
            <h1>What's on your plate?</h1>
            <p className="lead mt-3">
              Bring your meal to the table. Add a photo of your food, and optionally describe it with your voice. Let your pal get to know your plate!
            </p>
          </div>
          <div className="workspace-controls">
            <CompanionSelector value={companion} onChange={changeCompanion} />
            <MealHistory />
          </div>
        </header>

        <div className="meal-layout">
          <section className="workspace-panel" aria-labelledby="meal-picker-heading">
            <MealPicker image={mealImage} onSelectPhoto={selectPhoto} onRemovePhoto={removePhoto}
              onBusyChange={setIsPhotoBusy} resetKey={photoResetKey}
              error={imageError} onImageError={() => { removePhoto(); setImageError('We could not open that photo. Try a JPG, PNG, or WEBP image.'); }} />
            <AudioRecorder audio={mealAudio} onChange={selectAudio} onRecordingChange={setIsRecording} resetKey={audioResetKey} />
            <div className="meal-submit-actions">
              <button className="btn btn-primary analyze-meal-button" type="button"
                disabled={!mealImage || isRecording || isPhotoBusy || loading} onClick={submitMeal}>
                <AppIcon name="sparkle" />{loading ? 'Analyzing meal…' : 'Analyze meal'}
              </button>
              {(mealImage || mealAudio) && <button className="meal-start-over" type="button"
                disabled={isRecording || loading} onClick={resetMeal}>Start over</button>}
            </div>
            {analysisError && <p className="media-error" role="alert">{analysisError}</p>}
          </section>
          <section className="workspace-panel meal-results-panel" aria-labelledby="results-heading">
            <MealResults analysis={analysis} loading={loading} companion={companion}
              hasPhoto={!!mealImage} hasAudio={!!mealAudio} />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
