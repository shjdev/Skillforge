import { redirect } from 'next/navigation';

/** Ancienne adresse des horaires, désormais dans les réglages. */
export default function SchedulePage() {
  redirect('/settings');
}
