'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DomainSchema, DomainFormData } from '@/lib/schemas/admin.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CreateDomainFormProps {
  onSuccess?: () => void;
  domain?: DomainFormData & { id: string };
}

export function CreateDomainForm({ onSuccess, domain }: CreateDomainFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!domain;

  const { control, handleSubmit, formState: { errors } } = useForm<DomainFormData>({
    resolver: zodResolver(DomainSchema),
    defaultValues: domain || {
      name: '',
      slug: '',
      description: '',
      icon: 'BookOpen',
      color: '#3b82f6',
      order: 1,
      isActive: true,
    }
  });

  const saveDomainMutation = useMutation({
    mutationFn: async (data: DomainFormData) => {
      const res = await fetch(isEdit ? `/api/admin/domains/${domain!.id}` : '/api/admin/domains', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(isEdit ? 'Failed to update domain' : 'Failed to create domain');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains'] });
      onSuccess?.();
    },
  });

  const onSubmit = (data: DomainFormData) => {
    saveDomainMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom du domaine</Label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input id="name" placeholder="Ex: Informatique" {...field} />
          )}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL)</Label>
        <Controller
          name="slug"
          control={control}
          render={({ field }) => (
            <Input id="slug" placeholder="ex: informatique" {...field} />
          )}
        />
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea id="description" placeholder="Description du domaine..." {...field} />
          )}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Couleur</Label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <Input id="color" type="color" {...field} className="h-10 cursor-pointer" />
            )}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="order">Ordre d’affichage</Label>
          <Controller
            name="order"
            control={control}
            render={({ field }) => (
              <Input id="order" type="number" min="1" {...field} 
                onChange={(e) => field.onChange(parseInt(e.target.value))} 
              />
            )}
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={saveDomainMutation.isPending}>
          {saveDomainMutation.isPending
            ? (isEdit ? 'Enregistrement...' : 'Création...')
            : (isEdit ? 'Enregistrer les modifications' : 'Créer le domaine')}
        </Button>
      </div>
    </form>
  );
}
