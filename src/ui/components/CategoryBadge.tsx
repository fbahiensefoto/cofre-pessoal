export function CategoryBadge(props: { category: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        fontSize: '0.85em',
      }}
    >
      {props.category}
    </span>
  );
}
