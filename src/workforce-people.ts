type Person = { id: string; name: string; company: string };
export function workforcePersonName(state: {people?: Person[]; users?: Person[]}, id: string): string {
  const person = state.people?.find(p => p.id === id) || state.users?.find(p => p.id === id);
  return person ? `${person.name} — ${person.company}` : "Worker (name unavailable)";
}
