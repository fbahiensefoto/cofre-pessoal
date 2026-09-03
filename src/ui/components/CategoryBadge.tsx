export function CategoryBadge(props: { category: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        background: 'var(--color-accent)',
        color: 'var(--color-bg)',
        border: '1px solid var(--color-surface)',
        fontSize: '0.85em',
      }}
    >
      {props.category}
    </span>
  );
}
