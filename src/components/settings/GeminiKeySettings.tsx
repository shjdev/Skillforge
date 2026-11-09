'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import { storePersonalKey, usePersonalKey } from '@/hooks/usePersonalKey';

/**
 * Clé Gemini personnelle : gardée dans ce navigateur seulement, envoyée avec
 * les imports. Elle lève la limite quotidienne d'imports.
 */
export function GeminiKeySettings() {
  const queryClient = useQueryClient();
  const saved = usePersonalKey();
  const [value, setValue] = React.useState('');

  const store = (key: string | null) => {
    if (!storePersonalKey(key)) {
      toast.error('Ce navigateur bloque le stockage local : impossible d’enregistrer la clé.');
      return;
    }
    setValue('');
    queryClient.invalidateQueries({ queryKey: ['imports'] });
    toast.success(key ? 'Clé enregistrée dans ce navigateur.' : 'Clé retirée de ce navigateur.');
  };

  const trimmed = value.trim();
  const invalid = trimmed.length > 0 && (trimmed.length < 20 || /\s/.test(trimmed));

  return (
    <Card>
      <CardHeader kicker="Intelligence artificielle" title="Votre clé Gemini (facultatif)" />
      <CardBody className="flex flex-col gap-4">
        <p className="text-ink-2">
          Par défaut, SkillForge utilise sa propre clé, avec une limite d’imports par jour. Avec votre clé Google Gemini, vos
          imports sont illimités. Elle reste dans ce navigateur et n’est jamais enregistrée sur le serveur.
        </p>
        {saved ? (
          <div className="flex flex-col gap-3 rounded-md border border-rule bg-paper-sunken px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-sm">Clé enregistrée : …{saved.slice(-4)}</p>
            <Button variant="ghost" size="sm" onClick={() => store(null)}>
              Retirer la clé
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (trimmed && !invalid) store(trimmed);
            }}
          >
            <Field
              label="Clé API Gemini"
              hint="À créer gratuitement sur aistudio.google.com."
              error={invalid ? 'Cette clé ne semble pas valide.' : undefined}
              className="flex-1"
            >
              {({ id, describedBy, invalid: isInvalid }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={describedBy}
                  aria-invalid={isInvalid}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={!trimmed || invalid} className="sm:mb-7">
              Enregistrer
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
