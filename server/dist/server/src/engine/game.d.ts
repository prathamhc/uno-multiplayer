import { GameState, GameStatePublic, Player, RoomPublicState } from '../../../shared/types';
/**
 * Create a fresh game state from the list of players in a room
 */
export declare function createGameState(roomId: string, players: Player[]): GameState;
/**
 * Redact the game state for a specific socket — hide other players' hands
 */
export declare function redactState(state: GameState, socketId: string): GameStatePublic;
/**
 * Create a public room state from a room document
 */
export declare function createRoomPublicState(room: any): RoomPublicState;
//# sourceMappingURL=game.d.ts.map