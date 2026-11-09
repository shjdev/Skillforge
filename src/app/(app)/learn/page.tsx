import { redirect } from 'next/navigation';

/** Ancienne adresse : les thèmes s'ouvrent depuis la bibliothèque. */
export default function LearnIndex() {
  redirect('/library');
}
