import AppIcon from './AppIcon';
import { hasUnresolvedConflicts } from '../lib/mealHistory';
import { FITNESS_GOAL_LABELS } from '../lib/goalsApi';

const nutrientLabels = [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'], ['fiber', 'Fiber']];
const healthLabels = { balanced: 'Balanced meal', okay: 'Okay meal', needs_attention: 'Needs attention' };
const targetLabels = [['calories', 'Calories', ''], ['proteinGrams', 'Protein', ' g'],
  ['carbohydrateGrams', 'Carbs', ' g'], ['fatGrams', 'Fat', ' g'], ['fiberGrams', 'Fiber', ' g']];
const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export default function MealResults({ analysis, loading, companion, hasPhoto, hasAudio, onSave, saveStatus = {} }) {
  const conflicted = hasUnresolvedConflicts(analysis);
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
            {analysis.review?.allergyFlags.length > 0 && <div className="meal-allergy-flags" role="alert">
              <h3>Allergy check</h3>
              <ul>{analysis.review.allergyFlags.map((flag, index) => <li key={index}>
                <strong>{flag.allergen}</strong>{flag.foodNames.length > 0 && ` (${flag.foodNames.join(', ')})`}: {flag.note}
              </li>)}</ul>
            </div>}
            {analysis.recommendations.length > 0 && <div className="sample-suggestion">
              <h3>{companion} companion</h3>
              {analysis.review && <p className={`meal-health meal-health-${analysis.review.healthRating}`}>
                <strong>{healthLabels[analysis.review.healthRating]}.</strong> {analysis.review.healthNote}
              </p>}
              <ul>{analysis.recommendations.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul>
              {analysis.review?.additions.length > 0 && <p className="mb-1"><strong>Try adding:</strong> {analysis.review.additions.join(', ')}</p>}
              {analysis.review?.craving && <p className="mb-0"><strong>Your craving:</strong> {analysis.review.craving}</p>}
            </div>}
            {analysis.planUpdate && <div className="meal-plan">
              <h3>Your plan: {FITNESS_GOAL_LABELS[analysis.planUpdate.goals.fitnessGoal]}</h3>
              <p>{analysis.planUpdate.reason}</p>
              <dl className="meal-nutrients">
                {targetLabels.map(([key, label, unit]) => <div key={key}>
                  <dt>{label} / day</dt><dd>{analysis.planUpdate.goals.dailyTargets[key]}{unit}</dd>
                </div>)}
              </dl>
              {analysis.planUpdate.goals.weeklyGoals.length > 0 && <>
                <p className="mb-1"><strong>This week</strong></p>
                <ul>{analysis.planUpdate.goals.weeklyGoals.map((goal, index) => <li key={index}>{goal}</li>)}</ul>
              </>}
              <p className="meal-plan-note mb-0">{
                saveStatus.goals === 'updated' ? 'Your goals were updated.'
                  : saveStatus.goals === 'failed' ? 'Your meal was saved, but your goals could not be updated.'
                    : 'Saving this meal also updates your goals.'}</p>
            </div>}
            <p className="analysis-estimate-note">Nutrition values are estimates and depend on ingredients, portions, and preparation.</p>
            {onSave && <div className="meal-save">
              {saveStatus.state === 'saved' ? (
                <p className="meal-save-done" role="status"><AppIcon name="check" size={18} />Saved to your meal history.</p>
              ) : (
                <button className="btn btn-primary" type="button" onClick={onSave}
                  disabled={conflicted || saveStatus.state === 'saving'}>
                  <AppIcon name="history" />{saveStatus.state === 'saving' ? 'Saving meal…' : 'Save meal'}
                </button>
              )}
              {conflicted && <p className="meal-save-note">Your photo and voice note disagree about this meal, so it can't be saved yet.</p>}
              {saveStatus.error && <p className="media-error" role="alert">{saveStatus.error}</p>}
            </div>}
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
