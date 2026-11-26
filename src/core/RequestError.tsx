export function RequestError({ message, retry }: { message: string; retry: () => void }) {
  return <><p role="alert">{message}</p><button type="button" onClick={retry}>Réessayer</button></>;
}
