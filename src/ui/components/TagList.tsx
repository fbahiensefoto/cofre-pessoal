export function TagList(props: { tags: string[] }) {
  if (props.tags.length === 0) {
    return null;
  }
  return (
    <ul className="tags">
      {props.tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}
