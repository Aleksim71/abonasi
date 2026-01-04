export function ErrorBox({ title = 'Error', message }: { title?: string; message: string }) {
  return (
    <div className="card danger" role="alert">
      <strong>{title}</strong>
      <div className="small">{message}</div>
    </div>
  );
}
