import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { mealsApi } from '../lib/meals';
import { applyFoodEdits, mealDate } from '../lib/mealHistory';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const round = value => (Number.isFinite(value) ? Math.round(value) : '—');
const companionName = style => (style ? style[0].toUpperCase() + style.slice(1) : '');

function draftFor(meal) {
  return Object.fromEntries(meal.analysis.foods.map(food => [food.foodId,
    { name: food.name, amount: String(food.quantity.amount), unit: food.quantity.unit }]));
}

// BE-05: lists, edits and deletes the signed-in user's saved meals.
export default function MealHistory() {
  const dialog = useRef(null);
  const loadRequest = useRef(null);
  const [meals, setMeals] = useState([]);
  const [status, setStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(null);
  const [rowError, setRowError] = useState({ mealId: null, message: '' });
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => () => loadRequest.current?.abort(), []);

  async function load() {
    loadRequest.current?.abort();
    const request = new AbortController();
    loadRequest.current = request;
    setStatus('loading');
    setLoadError('');
    try {
      const result = await mealsApi.list({ signal: request.signal });
      if (loadRequest.current !== request) return;
      setMeals(result.filter(meal => meal?.mealId && Array.isArray(meal.analysis?.foods)));
      setStatus('ready');
    } catch (error) {
      if (loadRequest.current !== request || error.name === 'AbortError') return;
      setLoadError(error.message || 'Your meal history could not be loaded. Please try again.');
      setStatus('error');
    }
  }

  function open() {
    setEditing(null);
    setConfirmDelete(null);
    setRowError({ mealId: null, message: '' });
    setAnnouncement('');
    dialog.current.showModal();
    load();
  }

  function handleClose() {
    loadRequest.current?.abort();
    loadRequest.current = null;
    setStatus(current => (current === 'loading' ? 'idle' : current));
  }

  function startEdit(meal) {
    setConfirmDelete(null);
    setRowError({ mealId: null, message: '' });
    setEditing({ mealId: meal.mealId, draft: draftFor(meal) });
  }

  function changeDraft(foodId, field, value) {
    setEditing(current => ({ ...current,
      draft: { ...current.draft, [foodId]: { ...current.draft[foodId], [field]: value } } }));
  }

  async function saveEdit(meal) {
    setRowError({ mealId: null, message: '' });
    let analysis;
    try {
      analysis = applyFoodEdits(meal.analysis, editing.draft);
    } catch (error) {
      setRowError({ mealId: meal.mealId, message: error.message });
      return;
    }
    setBusy(meal.mealId);
    try {
      await mealsApi.update(meal.mealId, analysis);
      setMeals(current => current.map(item => (item.mealId === meal.mealId ? { ...item, analysis } : item)));
      setEditing(null);
      setAnnouncement('Meal updated.');
    } catch (error) {
      setRowError({ mealId: meal.mealId, message: error.message || 'Your changes could not be saved. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function remove(meal) {
    setRowError({ mealId: null, message: '' });
    setBusy(meal.mealId);
    try {
      await mealsApi.remove(meal.mealId);
      setMeals(current => current.filter(item => item.mealId !== meal.mealId));
      setConfirmDelete(null);
      setAnnouncement('Meal deleted.');
    } catch (error) {
      if (error.code === 'MEAL_NOT_FOUND') {
        setMeals(current => current.filter(item => item.mealId !== meal.mealId));
        setConfirmDelete(null);
        setAnnouncement('That meal had already been deleted.');
      } else {
        setRowError({ mealId: meal.mealId, message: error.message || 'This meal could not be deleted. Please try again.' });
      }
    } finally {
      setBusy(null);
    }
  }

  function renderMeal(meal) {
    const { analysis } = meal;
    const date = mealDate(meal);
    const isEditing = editing?.mealId === meal.mealId;
    const isBusy = busy === meal.mealId;
    const macros = analysis.estimatedMacros || {};
    const headingId = `meal-${meal.mealId}-heading`;

    return (
      <li className="saved-meal" key={meal.mealId} aria-labelledby={headingId} aria-busy={isBusy}>
        <div className="saved-meal-top">
          <div>
            <h3 id={headingId}>{date ? dateFormat.format(date) : 'Saved meal'}</h3>
            <p className="saved-meal-meta">
              {analysis.companionStyle && <span>{companionName(analysis.companionStyle)} companion</span>}
              {analysis.corrected && <span className="saved-meal-badge">Edited</span>}
            </p>
          </div>
          <strong className="saved-meal-calories">{round(macros.calories)}<small> cal</small></strong>
        </div>

        {isEditing ? (
          <form className="saved-meal-edit" onSubmit={event => { event.preventDefault(); saveEdit(meal); }}>
            {analysis.foods.map((food, index) => {
              const draft = editing.draft[food.foodId];
              const id = `${meal.mealId}-${food.foodId}`;
              return (
                <fieldset className="saved-meal-edit-row" key={food.foodId} disabled={isBusy}>
                  <legend className="visually-hidden">Food {index + 1}</legend>
                  <label htmlFor={`${id}-name`}>Food
                    <input className="form-control" id={`${id}-name`} value={draft.name} required
                      onChange={event => changeDraft(food.foodId, 'name', event.target.value)} />
                  </label>
                  <label htmlFor={`${id}-amount`}>Amount
                    <input className="form-control" id={`${id}-amount`} type="number" min="0" step="any"
                      inputMode="decimal" value={draft.amount} required
                      onChange={event => changeDraft(food.foodId, 'amount', event.target.value)} />
                  </label>
                  <label htmlFor={`${id}-unit`}>Unit
                    <input className="form-control" id={`${id}-unit`} value={draft.unit} required
                      onChange={event => changeDraft(food.foodId, 'unit', event.target.value)} />
                  </label>
                </fieldset>
              );
            })}
            <p className="saved-meal-hint">Changing an amount or unit doesn't recalculate calories or macros.</p>
            <div className="saved-meal-actions">
              <button className="btn btn-primary btn-sm" type="submit" disabled={isBusy}>
                {isBusy ? 'Saving…' : 'Save changes'}
              </button>
              <button className="btn btn-outline-primary btn-sm" type="button" disabled={isBusy}
                onClick={() => { setEditing(null); setRowError({ mealId: null, message: '' }); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <ul className="saved-meal-foods list-unstyled">
              {analysis.foods.map(food => (
                <li key={food.foodId}>
                  <span>{food.name} <small>{food.quantity.amount} {food.quantity.unit}</small></span>
                  {Number.isFinite(food.estimatedMacros?.calories) && <span>{round(food.estimatedMacros.calories)} cal</span>}
                </li>
              ))}
            </ul>
            <dl className="saved-meal-macros">
              <div><dt>Protein</dt><dd>{round(macros.proteinGrams)} g</dd></div>
              <div><dt>Carbs</dt><dd>{round(macros.carbohydrateGrams)} g</dd></div>
              <div><dt>Fat</dt><dd>{round(macros.fatGrams)} g</dd></div>
            </dl>
            {analysis.macroStatus === 'pending_recalculation' &&
              <p className="saved-meal-hint">Portions were edited, so these nutrition values may be out of date.</p>}
            {confirmDelete === meal.mealId ? (
              <div className="saved-meal-confirm" role="group" aria-label="Confirm delete">
                <p>Delete this meal? This can't be undone.</p>
                <div className="saved-meal-actions">
                  <button className="btn btn-danger btn-sm" type="button" disabled={isBusy} onClick={() => remove(meal)}>
                    {isBusy ? 'Deleting…' : 'Delete meal'}
                  </button>
                  <button className="btn btn-outline-primary btn-sm" type="button" disabled={isBusy}
                    onClick={() => setConfirmDelete(null)}>Keep it</button>
                </div>
              </div>
            ) : (
              <div className="saved-meal-actions">
                <button className="btn btn-outline-primary btn-sm" type="button" disabled={!!busy}
                  onClick={() => startEdit(meal)}>Edit</button>
                <button className="btn btn-outline-danger btn-sm" type="button" disabled={!!busy}
                  onClick={() => { setEditing(null); setRowError({ mealId: null, message: '' }); setConfirmDelete(meal.mealId); }}>
                  Delete
                </button>
              </div>
            )}
          </>
        )}
        {rowError.mealId === meal.mealId && <p className="media-error" role="alert">{rowError.message}</p>}
      </li>
    );
  }

  return (
    <>
      <button className="btn btn-outline-primary meal-history-button" type="button"
        aria-haspopup="dialog" aria-controls="meal-history-dialog" onClick={open}>
        <AppIcon name="history" />Meal History
      </button>

      <dialog className="meal-history-dialog" id="meal-history-dialog" ref={dialog} onClose={handleClose}
        aria-labelledby="meal-history-heading" aria-describedby="meal-history-description">
        <header className="meal-history-header">
          <div>
            <p className="eyebrow mb-2">Your plate over time</p>
            <h2 id="meal-history-heading">Meal history.</h2>
            <p className="meal-history-description" id="meal-history-description">
              Meals you've saved, newest first. Edit a food or portion, or remove a meal.
            </p>
          </div>
          <button className="meal-history-close" type="button" aria-label="Close meal history"
            onClick={() => dialog.current.close()}>
            <AppIcon name="close" />
          </button>
        </header>

        <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

        <div aria-busy={status === 'loading'}>
          {status === 'loading' && (
            <div className="meal-history-empty">
              <span className="analysis-spinner" aria-hidden="true" />
              <p>Loading your meals…</p>
            </div>
          )}
          {status === 'error' && (
            <div className="meal-history-empty" role="alert">
              <h3>We couldn't load your meals.</h3>
              <p>{loadError}</p>
              <button className="btn btn-outline-primary" type="button" onClick={load}>Try again</button>
            </div>
          )}
          {status === 'ready' && meals.length === 0 && (
            <div className="meal-history-empty">
              <span className="meal-history-symbol"><AppIcon name="history" size={32} /></span>
              <h3>No saved meals yet.</h3>
              <p>Analyze a meal, then choose Save meal to keep it here.</p>
            </div>
          )}
          {status === 'ready' && meals.length > 0 && (
            <ul className="saved-meals list-unstyled">{meals.map(renderMeal)}</ul>
          )}
        </div>

        <button className="btn btn-primary" type="button" onClick={() => dialog.current.close()}>
          Back to meal
        </button>
      </dialog>
    </>
  );
}
