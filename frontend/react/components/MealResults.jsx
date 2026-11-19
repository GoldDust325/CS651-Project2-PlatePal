import AppIcon from './AppIcon';

const nutrientLabels = [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'], ['fiber', 'Fiber']];
const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export default function MealResults({ analysis, loading, companion, hasPhoto, hasAudio }) {
  const nutrients = nutrientLabels.filter(([key]) => isAmount(analysis?.totals?.[key]));

  return (
    <>
      <p className="eyebrow mb-2">Meal insights</p>
      <h2 className="workspace-heading" id="results-heading">Your meal analysis.</h2>
      <p className="meal-section-description">Food, nutrition, and advice from your companion.</p>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="results-empty analysis-pending">
            <span className="analysis-spinner" aria-hidden="true" />
            <p className="fw-semibold mb-2">Getting to know your plate…</p>
            <p className="mb-0">The meal details you added are being analyzed.</p>
          </div>
        ) : analysis ? (
          <>
            <div className="sample-total my-4">
              <div><span className="sample-label">Nutritional estimate</span><p className="mb-0 mt-2">Total meal calories</p></div>
              <strong>{isAmount(analysis.totals?.calories) ? Math.round(analysis.totals.calories) : '—'}
                {isAmount(analysis.totals?.calories) && <small> cal</small>}</strong>
            </div>
            <ul className="food-results list-unstyled mb-4">
              {analysis.foods.map((food, index) => (
                <li className="food-result" key={food.name + index}>
                  <div><h3>{food.name}</h3>{food.portion && <p>{food.portion}</p>}</div>
                  {isAmount(food.calories) && <span>{Math.round(food.calories)} cal</span>}
                </li>
              ))}
            </ul>
            {nutrients.length > 0 && <dl className="meal-nutrients">
              {nutrients.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{analysis.totals[key]} g</dd></div>)}
            </dl>}
            {analysis.recommendations.length > 0 && <div className="sample-suggestion">
              <h3>{companion} companion</h3>
              <ul>{analysis.recommendations.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul>
            </div>}
            <p className="analysis-estimate-note">Nutrition values are estimates and depend on ingredients, portions, and preparation.</p>
          </>
        ) : (
          <div className="results-empty">
            <span className="results-empty-icon"><AppIcon name="plate" size={34} /></span>
            <h3>Ready when you are.</h3>
            <p>Add your meal photo or a voice description, then choose Analyze meal.</p>
            <div className="analysis-input-status">
              <span className={hasPhoto ? 'is-ready' : ''}><AppIcon name={hasPhoto ? 'check' : 'photo'} size={17} />{hasPhoto ? 'Photo added' : 'Photo'}</span>
              <span className={hasAudio ? 'is-ready' : ''}><AppIcon name={hasAudio ? 'check' : 'mic'} size={17} />{hasAudio ? 'Voice note added' : 'Voice note'}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
