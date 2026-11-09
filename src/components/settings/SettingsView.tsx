'use client';

import { Button } from '@/components/ui/button';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { useProfile } from '@/hooks/useProfile';
import { toErrorMessage } from '@/lib/errors';
import { GeminiKeySettings } from './GeminiKeySettings';
import { PasswordSettings } from './PasswordSettings';
import { ProfileSettings } from './ProfileSettings';

export function SettingsView() {
  const profile = useProfile();

  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (profile.isError) {
    return (
      <Notice tone="danger" title="Chargement impossible" action={<Button size="sm" onClick={() => profile.refetch()}>Réessayer</Button>}>
        {toErrorMessage(profile.error)}
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileSettings key={profile.dataUpdatedAt} profile={profile.data} />
      <GeminiKeySettings />
      {profile.data.canChangePassword && <PasswordSettings />}
    </div>
  );
}
