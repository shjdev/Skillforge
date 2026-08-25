'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TopicSchema, TopicFormData } from '@/lib/schemas/admin.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateTopicFormProps {
  domainId: string;
  siblings?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function CreateTopicForm({ domainId, siblings = [], onSuccess }: CreateTopicFormProps) {
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors } } = useForm<TopicFormData>({
    resolver: zodResolver(TopicSchema),
    defaultValues: {
      domainId,
      name: '',
      slug: '',
      description: '',
      maxDifficultyLevel: 5,
      estimatedWeeks: 1,
      prerequisites: [],
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: TopicFormData) => {
      const res = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create topic');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains'] });
      onSuccess?.();
    },
  });

  const onSubmit = (data: TopicFormData) => {
    createTopicMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="topic-name">Nom du thème</Label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input id="topic-name" placeholder="Ex: Fondamentaux Réseau" {...field} />
          )}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-slug">Slug (URL)</Label>
        <Controller
          name="slug"
          control={control}
          render={({ field }) => (
            <Input id="topic-slug" placeholder="ex: fondamentaux-reseau" {...field} />
          )}
        />
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-description">Description</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea id="topic-description" placeholder="Description du thème..." {...field} />
          )}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="topic-weeks">Semaines estimées</Label>
          <Controller
            name="estimatedWeeks"
            control={control}
            render={({ field }) => (
              <Input
                id="topic-weeks"
                type="number"
                min="1"
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic-difficulty">Niveau max (1-5)</Label>
          <Controller
            name="maxDifficultyLevel"
            control={control}
            render={({ field }) => (
              <Input
                id="topic-difficulty"
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

      {siblings.length > 0 && (
        <div className="space-y-2">
          <Label>Prérequis (thèmes à terminer avant celui-ci)</Label>
          <Controller
            name="prerequisites"
            control={control}
            render={({ field }) => (
              <div className="space-y-1 border rounded-md p-3">
                {siblings.map((s) => {
                  const checked = field.value.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? [...field.value, s.id]
                              : field.value.filter((id) => id !== s.id)
                          )
                        }
                        className="accent-[#3b82f6]"
                      />
                      {s.name}
                    </label>
                  );
                })}
              </div>
            )}
          />
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={createTopicMutation.isPending}>
          {createTopicMutation.isPending ? 'Création...' : 'Créer le thème'}
        </Button>
      </div>
    </form>
  );
}
