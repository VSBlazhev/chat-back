import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Room {
  password?: string;
  clients: Set<string>;
}

@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private rooms: Map<string, Room> = new Map();

  @SubscribeMessage('createRoom')
  handleCreateRoom(
    @MessageBody() data: { roomName: string; password?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (this.rooms.has(data.roomName)) {
      return { error: 'Room already exists' };
    }
    this.rooms.set(data.roomName, {
      password: data.password,
      clients: new Set(),
    });
    return { message: `Room ${data.roomName} created` };
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody()
    data: { roomName: string; username: string; password?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.rooms.get(data.roomName);
    if (!room) {
      return { error: 'Room does not exist' };
    }
    if (room.password && room.password !== data.password) {
      return { error: 'Invalid password' };
    }
    client.join(data.roomName);
    room.clients.add(client.id);
    this.server
      .to(data.roomName)
      .emit(
        'roomJoined',
        `User ${data.username} (${client.id}) joined room ${data.roomName}`,
      );
    return { room: data.roomName, message: `Joined room: ${data.roomName}` };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomName: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.rooms.get(data.roomName);
    if (room) {
      client.leave(data.roomName);
      room.clients.delete(client.id);
      this.server
        .to(data.roomName)
        .emit(
          'roomLeft',
          `User ${data.username} (${client.id}) left room ${data.roomName}`,
        );
      return { room: data.roomName, message: `Left room: ${data.roomName}` };
    }
    return { error: 'Room does not exist' };
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @MessageBody() data: { room: string; message: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.rooms.has(data.room)) {
      return { error: 'Room does not exist' };
    }
    this.server
      .to(data.room)
      .emit('message', { sender: data.username, message: data.message });
  }

  @SubscribeMessage('getRooms')
  handleGetRooms() {
    const roomList = Array.from(this.rooms.entries()).map(
      ([roomName, room]) => ({
        roomName,
        hasPassword: !!room.password,
      }),
    );
    return { rooms: roomList };
  }
}
