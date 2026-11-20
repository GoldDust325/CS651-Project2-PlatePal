import { useEffect, useRef } from 'react';
import MealPreview from './MealPreview';
import AppIcon from './AppIcon';
import GooglePhotosGallery from './GooglePhotosGallery';
import useGooglePhotos from '../hooks/useGooglePhotos';

export default function MealPicker({ image, onSelectPhoto, onRemovePhoto, onImageError, error, onBusyChange, resetKey = 0 }) {
  const fileInput = useRef(null);
  const google = useGooglePhotos(onSelectPhoto);
  useEffect(() => { onBusyChange?.(google.busy); }, [google.busy, onBusyChange]);
  useEffect(() => { google.reset(); }, [resetKey, google.reset]);

  function chooseLocal(file) {
    google.reset();
    onSelectPhoto(file);
  }

  function openFilePicker() {
    google.reset();
    fileInput.current.click();
  }

  function handleChange(event) {
    const file = event.target.files[0];
    if (file) chooseLocal(file);
    event.target.value = '';
  }

  return (
    <>
      <p className="eyebrow mb-2">Your meal</p>
      <h2 className="workspace-heading" id="meal-picker-heading">Add your meal.</h2>
      <p className="meal-section-description">Add a photo, a voice description, or both.</p>
      <div className="meal-photo-workspace" aria-busy={google.busy}>
        {google.busy && google.phase !== 'importing' ? (
          <div className="google-photos-waiting" role="status">
            <span className="google-photos-symbol"><AppIcon name="photo" size={34} /></span>
            <h3>{google.phase === 'authorizing' ? 'Connect to Google Photos' :
              google.phase === 'picking' ? 'Choose your meal photos' : 'Getting your photos…'}</h3>
            <p>{google.phase === 'authorizing' ? 'Choose your Google account and allow photo selection in the Google window.' :
              google.phase === 'picking' ? 'Select photos in Google Photos, then press Done. Your selection will appear here.' :
                'Your meal photos will be ready in a moment.'}</p>
            {google.phase === 'picking' && <a className="btn btn-primary" href={google.session.url}
              target="_blank" rel="noopener noreferrer">Open Google Photos</a>}
            <span className="analysis-spinner" aria-hidden="true" />
            <button className="meal-start-over" type="button" onClick={google.reset}>Cancel</button>
          </div>
        ) : (
          <>
            {(image || !google.photos.length) && <MealPreview image={image} onChoosePhoto={openFilePicker}
              onSelectPhoto={chooseLocal} onRemovePhoto={onRemovePhoto} onImageError={onImageError} />}
            {google.photos.length > 0 && <GooglePhotosGallery photos={google.photos} selectedId={image?.googlePhotoId}
              disabled={google.busy} loadThumbnail={google.thumbnail} onChoose={google.choose} />}
          </>
        )}
        {google.phase === 'importing' && <p className="google-photos-importing" role="status">Adding your meal photo…</p>}
      </div>
      <input ref={fileInput} className="visually-hidden" id="meal-photo" type="file"
        aria-label="Meal photo" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleChange} />
      <div className="meal-photo-actions">
        <button className="btn btn-primary" type="button" onClick={google.start}
          disabled={google.busy || google.sdk === 'loading'}>
          <AppIcon name="photo" /> Google Photos
        </button>
        <button className="btn btn-outline-primary" type="button" onClick={openFilePicker}>
          <AppIcon name="folder" /> Choose File
        </button>
        <span className="meal-file-hint">JPG, PNG or WEBP · Up to 10 MB</span>
      </div>
      {google.error && <p className="media-error" role="alert">{google.error}</p>}
      {error && <p className="media-error" role="alert">{error}</p>}
    </>
  );
}
