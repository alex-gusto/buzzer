import { z } from 'zod';

import type { RoomSnapshot } from './types';

export const RegisterMessageSchema = z.object({
  type: z.literal('register'),
  role: z.enum(['host', 'player']),
  hostSecret: z.string().trim().min(1).optional(),
  playerId: z.string().trim().min(1).optional(),
});

export const BuzzMessageSchema = z.object({
  type: z.literal('buzz'),
});

export const IncomingMessageSchema = z.discriminatedUnion('type', [
  RegisterMessageSchema,
  BuzzMessageSchema,
]);

export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type RegisterMessage = z.infer<typeof RegisterMessageSchema>;

export type OutgoingMessage =
  | {
      type: 'state';
      payload: RoomSnapshot;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'registered';
      role: 'host' | 'player';
      playerId?: string;
    };
