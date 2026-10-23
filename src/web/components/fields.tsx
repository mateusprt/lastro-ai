import { useEffect, useId, useState, type ReactNode } from 'react';
import { parseDecimal, toInputText } from '../domain/format.js';
import type { GlossaryKey } from '../domain/glossary.js';
import { InfoTip } from './InfoTip.js';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Mínimo exclusivo: o valor precisa ser maior que `min`. */
  exclusiveMin?: boolean;
  /** Termo do glossário explicado pelo botão "?" ao lado do rótulo. */
  info?: GlossaryKey;
}

/** Rótulo de campo com o botão "?" opcional. O botão fica fora do <label> para não focar o campo. */
export function FieldLabel({
  htmlFor,
  info,
  aside,
  children,
}: {
  htmlFor: string;
  info?: GlossaryKey | undefined;
  /** Conteúdo alinhado à direita, como o valor de um controle deslizante. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field-head">
      <label htmlFor={htmlFor} className="field-label">
        {children}
      </label>
      {info && <InfoTip term={info} />}
      {aside && <span className="field-aside">{aside}</span>}
    </div>
  );
}

/**
 * Campo numérico que aceita vírgula decimal e só aplica valores válidos. Enquanto
 * o texto é inválido, mantém o último valor bom e mostra o motivo.
 */
export function NumberField({ label, value, onChange, unit, hint, min, max, integer = false, exclusiveMin = false, info }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => toInputText(value));
  const [error, setError] = useState<string | null>(null);

  // Atualiza o texto quando o valor muda por fora (desfazer, outro campo).
  useEffect(() => {
    setText((current) => (parseDecimal(current) === value ? current : toInputText(value)));
    setError(null);
  }, [value]);

  const validate = (n: number | null): string | null => {
    if (n === null) return 'Digite um número.';
    if (integer && !Number.isInteger(n)) return 'Use um número inteiro.';
    if (min !== undefined && (exclusiveMin ? n <= min : n < min)) return exclusiveMin ? `Use um valor maior que ${toInputText(min)}.` : `O mínimo é ${toInputText(min)}.`;
    if (max !== undefined && n > max) return `O máximo é ${toInputText(max)}.`;
    return null;
  };

  return (
    <div className="field">
      <FieldLabel htmlFor={id} info={info}>
        {label}
      </FieldLabel>
      <div className={`field-control${error ? ' has-error' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={text}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseDecimal(e.target.value);
            const problem = validate(n);
            setError(problem);
            if (problem === null && n !== value) onChange(n!);
          }}
          onBlur={() => {
            setText(toInputText(value));
            setError(null);
          }}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      {error ? (
        <p id={`${id}-err`} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="field-control">
        <input id={id} type="text" value={value} maxLength={80} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  info,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
  info?: GlossaryKey;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-head">
        <label className="toggle" htmlFor={id}>
          <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span className="toggle-box" aria-hidden="true" />
          <span>{label}</span>
        </label>
        {info && <InfoTip term={info} />}
      </div>
      {hint && <p className="field-hint toggle-hint">{hint}</p>}
    </div>
  );
}
