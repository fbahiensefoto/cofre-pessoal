export function TagList(props: { tags: string[] }) {
  if (props.tags.length === 0) {
    return null;
  }
  return (
    <ul style={{ display: 'flex', gap: '4px', listStyle: 'none', padding: 0, margin: 0, flexWrap: 'wrap' }}>
      {props.tags.map((tag) => (
        <li key={tag} style={{ fontSize: '0.85em', color: 'var(--color-text)', opacity: 0.8 }}>
          {tag}
        </li>
      ))}
    </ul>
  );
}
