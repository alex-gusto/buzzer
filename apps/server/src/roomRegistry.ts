import type { GameRoom } from './types';

const normalizeCode = (code: string) => code.toUpperCase();

export class RoomRegistry {
  private readonly rooms = new Map<string, GameRoom>();

  has(code: string) {
    return this.rooms.has(normalizeCode(code));
  }

  get(code: string) {
    return this.rooms.get(normalizeCode(code));
  }

  set(room: GameRoom) {
    this.rooms.set(normalizeCode(room.code), room);
  }

  delete(code: string) {
    return this.rooms.delete(normalizeCode(code));
  }

  get size() {
    return this.rooms.size;
  }

  values() {
    return this.rooms.values();
  }
}
