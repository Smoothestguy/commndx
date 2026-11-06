import { z } from 'npm:zod@3';
export const extrasSchema = z.object({
  effective_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  travel_time: z.boolean().nullable().optional(),
  details: z.record(z.string().trim().min(1).max(80), z.string().max(500)).nullable().optional().refine(v=>!v||Object.keys(v).length<=20),
});
export const formSchema = extrasSchema.extend({
  location:z.string().uuid(),number:z.string().trim().min(1).max(60),kind:z.enum(['initial','increase','decrease','demobilization']),
  effective:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),notes:z.string().max(1000),name:z.string().trim().min(1).max(80),
  lines:z.array(z.object({line_kind:z.enum(['position','asset']),label:z.string().trim().min(1).max(60),qty:z.number().int().min(1).max(500)})).min(1).max(20),
});
export const requestSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('history'),token:z.string().uuid()}),
  z.object({action:z.literal('submit'),token:z.string().uuid(),form:formSchema}),
]);