import plate from '../../images/fork-knife-plate.png';
import AppIcon from './AppIcon';

export default function MealPreview({ image, onChoosePhoto, onSelectPhoto, onRemovePhoto, onImageError }) {
  function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) onSelectPhoto(file);
  }

  return (
    <figure className="meal-preview mb-0">
      <div className="meal-preview-frame">
        <button type="button" className={'meal-preview-image' + (image ? ' has-photo' : '')}
          aria-label={image ? 'Change meal photo' : 'Choose a meal photo'}
          onClick={onChoosePhoto} onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
          {image ? (
            <img src={image.url} alt="Your selected meal" onError={onImageError} />
          ) : (
            <span className="meal-preview-empty">
              <img className="pixel-plate-preview" src={plate} alt="" />
              <span className="meal-preview-prompt"><AppIcon name="photo" /> Add a meal photo</span>
              <span className="meal-preview-help">Choose a file or drag your photo here.</span>
            </span>
          )}
        </button>
        {image && <button className="meal-remove-photo" type="button" onClick={onRemovePhoto}
          aria-label="Remove meal photo"><AppIcon name="close" /></button>}
      </div>
      {image && <figcaption className="meal-filename" aria-live="polite">{image.name}</figcaption>}
    </figure>
  );
}
