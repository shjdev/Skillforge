'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LessonSchema, LessonFormData } from '@/lib/schemas/admin.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminLessonRow } from '@/types/models';

interface CreateLessonFormProps {
  topicId: string;
  onSuccess?: () => void;
  lesson?: AdminLessonRow;
}

function keyConceptsToText(concepts: string[]): string {
  return concepts.join(', ');
}

function textToKeyConcepts(text: string): string[] {
  return text
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function CreateLessonForm({ topicId, onSuccess, lesson }: CreateLessonFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!lesson;

  const { control, handleSubmit, formState: { errors } } = useForm<LessonFormData>({
    resolver: zodResolver(LessonSchema),
    defaultValues: lesson
      ? {
          topicId,
          title: lesson.title,
          contentMd: lesson.contentMd,
          dayNumber: lesson.dayNumber,
          sessionType: lesson.sessionType,
          difficultyLevel: lesson.difficultyLevel,
          durationMinutes: lesson.durationMinutes,
          keyConcepts: JSON.parse(lesson.keyConcepts || '[]'),
          bookReferenceId: lesson.bookReferenceId,
          chapterCitation: lesson.chapterCitation ?? null,
        }
      : {
          topicId,
          title: '',
          contentMd: '',
          dayNumber: 1,
          sessionType: 'MORNING',
          difficultyLevel: 1,
          durationMinutes: 30,
          keyConcepts: [],
          bookReferenceId: null,
          chapterCitation: null,
        },
  });

  const saveLessonMutation = useMutation({
    mutationFn: async (data: LessonFormData) => {
      const res = await fetch(isEdit ? `/api/admin/lessons/${lesson!.id}` : '/api/admin/lessons', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(isEdit ? 'Failed to update lesson' : 'Failed to create lesson');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains'] });
      onSuccess?.();
    },
  });

  const onSubmit = (data: LessonFormData) => {
    saveLessonMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lesson-title">Titre de la leçon</Label>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <Input id="lesson-title" placeholder="Ex: Introduction au chiffrement (Encryption)" {...field} />
          )}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lesson-content">Contenu (Markdown)</Label>
        <Controller
          name="contentMd"
          control={control}
          render={({ field }) => (
            <Textarea
              id="lesson-content"
              placeholder="# Titre&#10;&#10;Contenu de la leçon en français avec les termes techniques (English terms) entre parenthèses..."
              className="min-h-40 font-mono text-xs"
              {...field}
            />
          )}
        />
        {errors.contentMd && <p className="text-sm text-destructive">{errors.contentMd.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lesson-day">Jour (1-7)</Label>
          <Controller
            name="dayNumber"
            control={control}
            render={({ field }) => (
              <Input
                id="lesson-day"
                type="number"
                min="1"
                max="7"
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lesson-duration">Durée (min)</Label>
          <Controller
            name="durationMinutes"
            control={control}
            render={({ field }) => (
              <Input
                id="lesson-duration"
                type="number"
                min="5"
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lesson-difficulty">Niveau (1-5)</Label>
          <Controller
            name="difficultyLevel"
            control={control}
            render={({ field }) => (
              <Input
                id="lesson-difficulty"
                type="number"
                min="1"
                max="5"
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lesson-session-type">Moment de la session</Label>
        <Controller
          name="sessionType"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="lesson-session-type" className="w-full">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MORNING">🌅 Matin</SelectItem>
                <SelectItem value="EVENING">🌙 Soir</SelectItem>
                <SelectItem value="FULL_DAY">📖 Journée complète</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lesson-concepts">Concepts clés (séparés par des virgules)</Label>
        <Controller
          name="keyConcepts"
          control={control}
          render={({ field }) => (
            <Input
              id="lesson-concepts"
              placeholder="Ex: Chiffrement symétrique (Symmetric Encryption), Clé publique (Public Key)"
              defaultValue={keyConceptsToText(field.value)}
              onChange={(e) => field.onChange(textToKeyConcepts(e.target.value))}
            />
          )}
        />
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={saveLessonMutation.isPending}>
          {saveLessonMutation.isPending
            ? (isEdit ? 'Enregistrement...' : 'Création...')
            : (isEdit ? 'Enregistrer les modifications' : 'Créer la leçon')}
        </Button>
      </div>
    </form>
  );
}
