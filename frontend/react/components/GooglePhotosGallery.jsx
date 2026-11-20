import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';

function PhotoThumbnail({ photo, selected, disabled, load, onChoose }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const request = new AbortController();
    let localUrl;
    loader.current(photo, request.signal).then(blob => {
      if (request.signal.aborted) return;
      localUrl = URL.createObjectURL(blob);
      setUrl(localUrl);
    }).catch(failure => { if (failure.name !== 'AbortError' && !request.signal.aborted) setFailed(true); });
    return () => { request.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [photo]);

  return (
    <button type="button" className={'google-photo-tile' + (selected ? ' is-selected' : '')}
      aria-label={`Use ${photo.name} as your meal photo`} aria-pressed={selected}
      disabled={disabled} onClick={() => onChoose(photo)}>
      <span className="google-photo-thumbnail">
        {url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> :
          <span className="google-photo-thumbnail-placeholder"><AppIcon name="photo" size={28} />
            <span>{failed ? 'Preview unavailable' : 'Loading…'}</span></span>}
        {selected && <span className="google-photo-check"><AppIcon name="check" size={16} /></span>}
      </span>
      <span className="google-photo-name">{photo.name}</span>
    </button>
  );
}

export default function GooglePhotosGallery({ photos, selectedId, disabled, loadThumbnail, onChoose }) {
  return (
    <div className="google-photos-gallery" role="group" aria-label="Photos selected from Google Photos">
      <div className="google-photos-gallery-heading">
        <span>From Google Photos</span><span>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
      </div>
      <p>Choose a photo to add to your meal.</p>
      <div className="google-photos-grid">
        {photos.map(photo => <PhotoThumbnail key={photo.id} photo={photo} selected={selectedId === photo.id}
          disabled={disabled} load={loadThumbnail} onChoose={onChoose} />)}
      </div>
    </div>
  );
}
