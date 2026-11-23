import { useRef } from 'react';
import AppIcon from './AppIcon';

// Frontend entry point only. The team can connect saved meals here later.
export default function MealHistory() {
  const dialog = useRef(null);

  return (
    <>
      <button className="btn btn-outline-primary meal-history-button" type="button"
        aria-haspopup="dialog" aria-controls="meal-history-dialog"
        onClick={() => dialog.current.showModal()}>
        <AppIcon name="history" />Meal History
      </button>

      <dialog className="meal-history-dialog" id="meal-history-dialog" ref={dialog}
        aria-labelledby="meal-history-heading" aria-describedby="meal-history-description">
        <header className="meal-history-header">
          <div>
            <p className="eyebrow mb-2">Your plate over time</p>
            <h2 id="meal-history-heading">Meal history.</h2>
          </div>
          <button className="meal-history-close" type="button" aria-label="Close meal history"
            onClick={() => dialog.current.close()}>
            <AppIcon name="close" />
          </button>
        </header>

        <div className="meal-history-empty">
          <span className="meal-history-symbol"><AppIcon name="history" size={32} /></span>
          <h3>Your meals, all in one place.</h3>
          <p id="meal-history-description">Meal history is coming soon. Your saved meals will appear here when it’s available.</p>
        </div>

        <button className="btn btn-primary" type="button" onClick={() => dialog.current.close()}>
          Back to meal
        </button>
      </dialog>
    </>
  );
}
