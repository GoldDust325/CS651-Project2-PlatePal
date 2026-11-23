// Both forms reuse the same label, input, and Bootstrap spacing.
export default function FormField({ id, label, type = 'text', value, onChange,
  autoComplete, inputRef, autoFocus = false, required = false, minLength, maxLength, disabled = false }) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input className="form-control" id={id} name={id} type={type}
        value={value} onChange={event => onChange(event.target.value)}
        autoComplete={autoComplete} ref={inputRef} autoFocus={autoFocus}
        required={required} minLength={minLength} maxLength={maxLength} disabled={disabled} />
    </div>
  );
}
