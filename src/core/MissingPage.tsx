export function MissingPage({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <a href="/recipes">Retour au catalogue</a>
    </>
  );
}
