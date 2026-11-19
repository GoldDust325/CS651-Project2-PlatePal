import AppIcon from './AppIcon.jsx';
import casualCompanion from '../../images/companions/casual.png';
import strictCompanion from '../../images/companions/strict.png';
import athleteCompanion from '../../images/companions/athlete.png';

const companions = [
  { name: 'Casual', image: casualCompanion, description: 'A friendly nudge.' },
  { name: 'Strict', image: strictCompanion, description: 'Straight to the point.' },
  { name: 'Athlete', image: athleteCompanion, description: 'A little extra drive.' },
];

export default function CompanionSelector({ value, onChange }) {
  const selected = Math.max(0, companions.findIndex(item => item.name === value));

  return (
    <fieldset className="companion-control"
      style={{ '--companion-index': selected, '--companion-progress': (selected / 2 * 100) + '%' }}>
      <legend className="visually-hidden">Companion style</legend>
      <div className="companion-surface">
        <div className="companion-heading" aria-hidden="true">
          <span>Companion style</span>
          <AppIcon name="sparkle" size={19} />
        </div>
        <div className="companion-slider-wrap">
          <div className="companion-rail" aria-hidden="true">
            <span className="companion-rail-fill" />
            {companions.map((item, index) => (
              <span key={item.name} className={'companion-stop' + (selected >= index ? ' is-reached' : '')}
                style={{ left: (index / 2 * 100) + '%' }} />
            ))}
          </div>
          <input className="companion-slider" type="range" min="0" max="2" step="1"
            value={selected} aria-label="Companion style" aria-valuetext={companions[selected].name}
            aria-describedby="companion-description"
            onChange={event => onChange(companions[Number(event.target.value)].name)} />
        </div>
        <div className="companion-slider-labels">
          <span className="companion-label-highlight" aria-hidden="true" />
          {companions.map((item, index) => (
            <button key={item.name} type="button" aria-pressed={selected === index}
              className={selected === index ? 'is-selected' : ''}
              onClick={() => onChange(item.name)}>
              <img className="companion-mode-mascot" src={item.image} alt="" width="72" height="68" draggable={false} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <p id="companion-description" className="companion-description">{companions[selected].description}</p>
      </div>
    </fieldset>
  );
}
