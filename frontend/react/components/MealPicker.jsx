import { useRef } from 'react';
import MealPreview from './MealPreview';
import AppIcon from './AppIcon';

export default function MealPicker({ image, onSelectPhoto, onRemovePhoto, onImageError, error }) {
  const fileInput = useRef(null);

  function handleChange(event) {
    const file = event.target.files[0];
    if (file) onSelectPhoto(file);
    event.target.value = '';
  }

  return (
    <>
      <p className="eyebrow mb-2">Your meal</p>
      <h2 className="workspace-heading" id="meal-picker-heading">Add your meal.</h2>
      <p className="meal-section-description">Add a photo, a voice description, or both.</p>
      <MealPreview image={image} onChoosePhoto={() => fileInput.current.click()}
        onSelectPhoto={onSelectPhoto} onRemovePhoto={onRemovePhoto} onImageError={onImageError} />
      <input ref={fileInput} className="visually-hidden" id="meal-photo" type="file"
        aria-label="Meal photo" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleChange} />
      <div className="meal-photo-actions">
        <button className="btn btn-outline-primary" type="button" onClick={() => fileInput.current.click()}>
          <AppIcon name="folder" /> {image ? 'Change photo' : 'Choose photo'}
        </button>
        <span className="meal-file-hint">JPG, PNG or WEBP · Up to 10 MB</span>
      </div>
      {error && <p className="media-error" role="alert">{error}</p>}
    </>
  );
}
